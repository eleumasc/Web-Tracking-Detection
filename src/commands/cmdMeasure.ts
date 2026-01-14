import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import Flatted from "flatted";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { Flow, SyntacticFlow, TaintFlow } from "../core/Flow";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getSiteFromUrl } from "../util/site";
import { HarReader } from "../util/HarReader";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { processFlows } from "../core/processFlows";
import { processTaskQueue } from "../util/TaskQueue";
import { readFileSync } from "fs";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";
import { TrackerEquivalence, viewTrackers } from "../core/Tracker";
import { verifySyntacticFlows } from "../core/syntacticMatching/verifySyntacticFlows";
import {
  casesCount,
  createStatsReducer,
  LocalStats,
  Stats,
  subLocalStats,
} from "../core/Stats";
import {
  CanonicalFlowEquivalence,
  viewSyntacticCanonicalFlows,
  viewTaintCanonicalFlows,
} from "../core/CanonicalFlow";

export default async function cmdMeasure(args: {
  analysisId: number;
  maxTasks: number;
}) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);
  const { name: analysisName } = analysisCollection;

  const outputName = `${currentTime()}-Measure-${analysisId}`;

  let totalSites = 0;
  let successSites = 0;
  let stats: Stats = {};
  const statsReducer = createStatsReducer();

  await processTaskQueue(
    store.getDocumentsByCollection(analysisCollection.id),
    { maxTasks: args.maxTasks },
    (analysisDocument, queueIndex) => async () => {
      const siteName = analysisDocument.name;
      console.log(siteName, queueIndex);

      totalSites += 1;

      const analysisLogEntry = store.getDocumentData<
        AnalysisLogEntry<StatefulTrackingAnalysisResult>
      >(analysisDocument.id);

      if (isFailure(analysisLogEntry)) return;
      const { value: staResult } = analysisLogEntry;

      successSites += 1;

      const localStats = await execThread<ReturnType<typeof measureSite>>(
        makeTaskFromFunction(measureSite, [
          {
            siteName,
            analysisName,
            outputName,
            staResult,
          },
        ])
      );

      stats = statsReducer(stats, localStats);
    }
  );

  const report = {
    totalSites,
    successSites,
    ...stats,
  };
  console.log(report);
  writeOutputFileSync(
    path.join(outputName, "report.json"),
    JSON.stringify(report)
  );

  process.exit(0);
}

export function measureSite(args: {
  siteName: string;
  analysisName: string;
  outputName: string;
  staResult: StatefulTrackingAnalysisResult;
  forceNoVerif?: boolean;
}) {
  const { siteName, analysisName, outputName, staResult, forceNoVerif } = args;

  let rawTaintFlows: TaintFlow[];
  let rawSyntacticFlows: SyntacticFlow[];
  let verifyResult;
  if (staResult.verif && !forceNoVerif) {
    rawTaintFlows = Flatted.parse(
      readFileSync(
        path.join(getOutputPath(analysisName), staResult.verif.taintFlowsFile)
      ).toString()
    );
    rawSyntacticFlows = Flatted.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.syntacticFlowsFile
        )
      ).toString()
    );
    const storageCanariesEntries = Flatted.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.storageCanariesFile
        )
      ).toString()
    );
    verifyResult = verifySyntacticFlows(
      rawSyntacticFlows,
      storageCanariesEntries,
      new HarReader(
        path.join(getOutputPath(analysisName), staResult.verif.harFile)
      ),
      new HarReader(
        path.join(getOutputPath(analysisName), staResult.auxVerif!.harFile)
      )
    );
  } else {
    const processed = processFlows({
      analysisName,
      auxConnectResult: staResult.aux.connectResult,
      preConnectResult: staResult.pre.connectResult,
      taintHarFile: staResult.taint.harFile,
      taintTaintFile: staResult.taint.taintFile,
    });
    rawTaintFlows = processed.taintFlows;
    rawSyntacticFlows = processed.syntacticFlows;
    const storageCanariesEntries = processed.storageCanariesEntries;
    writeOutputFileSync(
      path.join(outputName, `${siteName}+TF.json`),
      Flatted.stringify(rawTaintFlows)
    );
    writeOutputFileSync(
      path.join(outputName, `${siteName}+SF.json`),
      Flatted.stringify(rawSyntacticFlows)
    );
    writeOutputFileSync(
      path.join(outputName, `${siteName}+C.json`),
      Flatted.stringify(storageCanariesEntries)
    );
  }

  const firstParty = getSiteFromUrl(
    staResult.taint.connectResult.landingPageUrl
  );
  const filterThirdPartyFlows = <T extends Flow>(flows: T[]): T[] =>
    flows.filter((flow) => getSiteFromUrl(flow.requestUrl) !== firstParty);
  rawTaintFlows = filterThirdPartyFlows(rawTaintFlows);
  rawSyntacticFlows = filterThirdPartyFlows(rawSyntacticFlows);

  let details: Record<string, any> = {};
  const addDetails = (src: Record<string, any>) => {
    details = _.assign(details, src);
  };
  let stats: LocalStats = {};
  const addStats = (localStats: LocalStats) => {
    stats = _.assign(stats, localStats);
  };
  const addCasesCountStats = (obj: { [key: string]: any[] }) => {
    addStats(_.mapValues(obj, (x) => casesCount(x)));
  };

  const taintTrackers = TrackerEquivalence.getAllKeys(rawTaintFlows);
  const syntacticTrackers = TrackerEquivalence.getAllKeys(rawSyntacticFlows);
  const intersectTrackers = _.intersectionWith(
    taintTrackers,
    syntacticTrackers,
    _.isEqual
  );
  const onlyTaintTrackers = _.differenceWith(
    taintTrackers,
    syntacticTrackers,
    _.isEqual
  );
  const onlySyntacticTrackers = _.differenceWith(
    syntacticTrackers,
    taintTrackers,
    _.isEqual
  );
  addDetails({
    intersectTrackers: viewTrackers(intersectTrackers, rawTaintFlows),
    onlyTaintTrackers: viewTrackers(onlyTaintTrackers, rawTaintFlows),
    onlySyntacticTrackers: viewTrackers(
      onlySyntacticTrackers,
      rawSyntacticFlows
    ),
  });
  addCasesCountStats({
    intersectTrackers,
    onlyTaintTrackers,
    onlySyntacticTrackers,
  });

  if (verifyResult) {
    const trueOnlySyntacticTrackers = _.intersectionWith(
      TrackerEquivalence.getAllKeys(verifyResult.trueFlows),
      onlySyntacticTrackers,
      _.isEqual
    );
    addDetails({
      trueOnlySyntacticTrackers: viewTrackers(
        trueOnlySyntacticTrackers,
        verifyResult.trueFlows
      ),
    });
    addCasesCountStats({
      trueOnlySyntacticTrackers,
    });
  }

  const taintFlows = CanonicalFlowEquivalence.getAllKeys(rawTaintFlows);
  const syntacticFlows = CanonicalFlowEquivalence.getAllKeys(rawSyntacticFlows);
  const intersectFlows = _.intersectionWith(
    taintFlows,
    syntacticFlows,
    _.isEqual
  );
  const onlyTaintFlows = _.differenceWith(
    taintFlows,
    syntacticFlows,
    _.isEqual
  );
  const onlySyntacticFlows = _.differenceWith(
    syntacticFlows,
    taintFlows,
    _.isEqual
  );
  addDetails({
    intersectFlows: viewTaintCanonicalFlows(intersectFlows, rawTaintFlows),
    onlyTaintFlows: viewTaintCanonicalFlows(onlyTaintFlows, rawTaintFlows),
    onlySyntacticFlows: viewSyntacticCanonicalFlows(
      onlySyntacticFlows,
      rawSyntacticFlows
    ),
  });
  addCasesCountStats({
    intersectFlows,
    onlyTaintFlows,
    onlySyntacticFlows,
  });

  if (verifyResult) {
    const onlySyntacticFlowsClasses = _.mapValues(verifyResult, (flows) =>
      _.intersectionWith(
        CanonicalFlowEquivalence.getAllKeys(flows),
        onlySyntacticFlows,
        _.isEqual
      )
    );
    addDetails({
      trueOnlySyntacticFlows: viewSyntacticCanonicalFlows(
        onlySyntacticFlowsClasses.trueFlows,
        verifyResult.trueFlows
      ),
      fakeOnlySyntacticFlows: viewSyntacticCanonicalFlows(
        onlySyntacticFlowsClasses.fakeFlows,
        verifyResult.fakeFlows
      ),
      unknownOnlySyntacticFlows: viewSyntacticCanonicalFlows(
        onlySyntacticFlowsClasses.unknownFlows,
        verifyResult.unknownFlows
      ),
    });
    addStats({
      onlySyntacticFlowsClasses: subLocalStats(
        _.mapValues(onlySyntacticFlowsClasses, (x) => casesCount(x))
      ),
    });
  }

  writeOutputFileSync(
    path.join(outputName, `${siteName}.json`),
    JSON.stringify({
      site: siteName,
      ...details,
    })
  );

  return stats;
}
