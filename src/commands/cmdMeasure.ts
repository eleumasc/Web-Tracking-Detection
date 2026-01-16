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
import { verifySyntacticTrackingRequests } from "../core/syntacticMatching/verifySyntacticTrackingRequests";
import {
  casesCount,
  createStatsReducer,
  LocalStats,
  Stats,
  subLocalStats,
} from "../core/Stats";
import {
  TrackingRequest,
  TrackingRequestEquivalence,
  viewSyntacticTrackingRequests,
  viewTaintTrackingRequests,
} from "../core/TrackingRequest";

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

  let taintFlows: TaintFlow[];
  let syntacticFlows: SyntacticFlow[];
  let doVerify;
  if (staResult.verif && !forceNoVerif) {
    taintFlows = Flatted.parse(
      readFileSync(
        path.join(getOutputPath(analysisName), staResult.verif.taintFlowsFile)
      ).toString()
    );
    syntacticFlows = Flatted.parse(
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
    doVerify = (trkRequests: TrackingRequest[]) =>
      verifySyntacticTrackingRequests(
        trkRequests,
        syntacticFlows,
        storageCanariesEntries,
        new HarReader(
          path.join(getOutputPath(analysisName), staResult.verif!.harFile)
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
    taintFlows = processed.taintFlows;
    syntacticFlows = processed.syntacticFlows;
    const storageCanariesEntries = processed.storageCanariesEntries;
    writeOutputFileSync(
      path.join(outputName, `${siteName}+TF.json`),
      Flatted.stringify(taintFlows)
    );
    writeOutputFileSync(
      path.join(outputName, `${siteName}+SF.json`),
      Flatted.stringify(syntacticFlows)
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
  taintFlows = filterThirdPartyFlows(taintFlows);
  syntacticFlows = filterThirdPartyFlows(syntacticFlows);

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

  const taintRequests = TrackingRequestEquivalence.getAllKeys(taintFlows);
  const syntacticRequests =
    TrackingRequestEquivalence.getAllKeys(syntacticFlows);
  const intersectRequests = _.intersectionWith(
    taintRequests,
    syntacticRequests,
    _.isEqual
  );
  const onlyTaintRequests = _.differenceWith(
    taintRequests,
    syntacticRequests,
    _.isEqual
  );
  const onlySyntacticRequests = _.differenceWith(
    syntacticRequests,
    taintRequests,
    _.isEqual
  );
  addDetails({
    intersectRequests: viewTaintTrackingRequests(intersectRequests, taintFlows),
    onlyTaintRequests: viewTaintTrackingRequests(onlyTaintRequests, taintFlows),
    onlySyntacticRequests: viewSyntacticTrackingRequests(
      onlySyntacticRequests,
      syntacticFlows
    ),
  });
  addCasesCountStats({
    taintRequests,
    syntacticRequests,
    intersectRequests,
    onlyTaintRequests,
    onlySyntacticRequests,
  });

  const verifyResult = doVerify?.(onlySyntacticRequests);
  if (verifyResult) {
    const { verifiedRequests, confutedRequests, unknownRequests } =
      verifyResult;
    addDetails({
      verifiedRequests: viewSyntacticTrackingRequests(
        verifiedRequests,
        verifyResult.verifiedFlows
      ),
      confutedRequests: viewSyntacticTrackingRequests(
        confutedRequests,
        verifyResult.confutedFlows
      ),
      unknownRequests: viewSyntacticTrackingRequests(
        unknownRequests,
        _.union(verifyResult.unknownFlows, verifyResult.confutedFlows)
      ),
    });
    addStats({
      onlySyntacticRequestsClasses: subLocalStats(
        _.mapValues(
          {
            verifiedRequests,
            confutedRequests,
            unknownRequests,
          },
          (x) => casesCount(x)
        )
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
