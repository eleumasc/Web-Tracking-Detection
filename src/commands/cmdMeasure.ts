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
  CanonicalFlowEquivalence,
  viewSyntacticCanonicalFlows,
  viewTaintCanonicalFlows,
} from "../core/CanonicalFlow";

type CasesSitesEntry = {
  cases: number;
  sites: number;
};

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
  let stats: Record<string, CasesSitesEntry> = {};
  const addStats = (src: Record<string, number>) => {
    _.assignWith(
      stats,
      src,
      (
        { cases, sites }: CasesSitesEntry = { cases: 0, sites: 0 },
        value: number,
        key: string
      ) => ({
        cases: cases + value,
        sites: sites + (value !== 0 ? 1 : 0),
      })
    );
  };

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

      const partialStats = await execThread<ReturnType<typeof measureSite>>(
        makeTaskFromFunction(measureSite, [
          {
            siteName,
            analysisName,
            outputName,
            staResult,
          },
        ])
      );

      addStats(partialStats);
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
  let stats: Record<string, number> = {};
  const addStats = (src: Record<string, any[]>) => {
    stats = _.assign(
      stats,
      _.mapValues(src, (elements) => elements.length)
    );
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
  addStats({
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
    addStats({
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
  addStats({
    intersectFlows,
    onlyTaintFlows,
    onlySyntacticFlows,
  });

  if (verifyResult) {
    const trueOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(verifyResult.trueFlows),
      onlySyntacticFlows,
      _.isEqual
    );
    const fakeOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(verifyResult.fakeFlows),
      onlySyntacticFlows,
      _.isEqual
    );
    const unknownOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(verifyResult.unknownFlows),
      onlySyntacticFlows,
      _.isEqual
    );
    const zeroMatchingRequestsOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(
        verifyResult.zeroMatchingRequestsFlows
      ),
      onlySyntacticFlows,
      _.isEqual
    );
    const oneMatchingRequestOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(verifyResult.oneMatchingRequestFlows),
      onlySyntacticFlows,
      _.isEqual
    );
    addDetails({
      trueOnlySyntacticFlows: viewSyntacticCanonicalFlows(
        trueOnlySyntacticFlows,
        verifyResult.trueFlows
      ),
      fakeOnlySyntacticFlows: viewSyntacticCanonicalFlows(
        fakeOnlySyntacticFlows,
        verifyResult.fakeFlows
      ),
      unknownOnlySyntacticFlows: viewSyntacticCanonicalFlows(
        unknownOnlySyntacticFlows,
        verifyResult.unknownFlows
      ),
    });
    addStats({
      trueOnlySyntacticFlows,
      fakeOnlySyntacticFlows,
      unknownOnlySyntacticFlows,
      zeroMatchingRequestsOnlySyntacticFlows,
      oneMatchingRequestOnlySyntacticFlows,
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
