import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import Flatted from "flatted";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { AbstractFlow } from "../core/AbstractFlow";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getSiteByUrl } from "../util/site";
import { HarReader } from "../util/HarReader";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { processFlows } from "../core/processFlows";
import { processTaskQueue } from "../util/TaskQueue";
import { readFileSync } from "fs";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";
import { truncateValuesInOperationToken } from "../core/syntacticMatching/Token";
import { verifySyntacticAbstractFlows } from "../core/syntacticMatching/verifySyntacticAbstractFlows";
import {
  AggregateFlow,
  toAggregateFlow,
  toAggregateFlows,
} from "../core/AggregateFlow";

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

  let totalSitesCount = 0;
  let successSitesCount = 0;

  let intersectFlowsCount = 0;
  let onlyTaintFlowsCount = 0;
  let onlySyntacticFlowsCount = 0;
  let trueOnlySyntacticFlowsCount = 0;
  let syntacticFlowsCount = 0;
  let trueSyntacticFlowsCount = 0;

  let intersectFlowsSitesCount = 0;
  let onlyTaintFlowsSitesCount = 0;
  let onlySyntacticFlowsSitesCount = 0;
  let trueOnlySyntacticFlowsSitesCount = 0;
  let syntacticFlowsSitesCount = 0;
  let trueSyntacticFlowsSitesCount = 0;

  await processTaskQueue(
    store.getDocumentsByCollection(analysisCollection.id),
    { maxTasks: args.maxTasks },
    (analysisDocument, queueIndex) => async () => {
      const siteName = analysisDocument.name;
      console.log(siteName, queueIndex);

      totalSitesCount += 1;

      const analysisLogEntry = store.getDocumentData<
        AnalysisLogEntry<StatefulTrackingAnalysisResult>
      >(analysisDocument.id);

      if (isFailure(analysisLogEntry)) return;
      const { value: staResult } = analysisLogEntry;

      successSitesCount += 1;

      const s = await execThread<ReturnType<typeof measureSite>>(
        makeTaskFromFunction(measureSite, [
          {
            siteName,
            analysisName,
            outputName,
            staResult,
          },
        ])
      );

      intersectFlowsCount += s.intersectFlowsCount;
      onlyTaintFlowsCount += s.onlyTaintFlowsCount;
      onlySyntacticFlowsCount += s.onlySyntacticFlowsCount;
      trueOnlySyntacticFlowsCount += s.trueOnlySyntacticFlowsCount;
      syntacticFlowsCount += s.syntacticFlowsCount;
      trueSyntacticFlowsCount += s.trueSyntacticFlowsCount;

      intersectFlowsSitesCount += s.intersectFlowsSitesCount;
      onlyTaintFlowsSitesCount += s.onlyTaintFlowsSitesCount;
      onlySyntacticFlowsSitesCount += s.onlySyntacticFlowsSitesCount;
      trueOnlySyntacticFlowsSitesCount += s.trueOnlySyntacticFlowsSitesCount;
      syntacticFlowsSitesCount += s.syntacticFlowsSitesCount;
      trueSyntacticFlowsSitesCount += s.trueSyntacticFlowsSitesCount;
    }
  );

  const report = {
    totalSitesCount,
    successSitesCount,

    intersectFlowsCount,
    onlyTaintFlowsCount,
    onlySyntacticFlowsCount,
    trueOnlySyntacticFlowsCount,
    syntacticFlowsCount,
    trueSyntacticFlowsCount,
    taintEnhancement: onlyTaintFlowsCount / trueSyntacticFlowsCount,

    intersectFlowsSitesCount,
    onlyTaintFlowsSitesCount,
    onlySyntacticFlowsSitesCount,
    trueOnlySyntacticFlowsSitesCount,
    syntacticFlowsSitesCount,
    trueSyntacticFlowsSitesCount,
    taintEnhancementSites:
      onlyTaintFlowsSitesCount / trueSyntacticFlowsSitesCount,
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

  let taintAbstractFlows: AbstractFlow[];
  let syntacticAbstractFlows: AbstractFlow[];
  let trueSyntacticAbstractFlows: AbstractFlow[];
  let verifSites = new Set<string>();
  if (staResult.verif && !forceNoVerif) {
    taintAbstractFlows = Flatted.parse(
      readFileSync(
        path.join(getOutputPath(analysisName), staResult.verif.taintFlowsFile)
      ).toString()
    );
    syntacticAbstractFlows = Flatted.parse(
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
    const verifHarReader = new HarReader(
      path.join(getOutputPath(analysisName), staResult.verif.harFile)
    );
    trueSyntacticAbstractFlows = verifySyntacticAbstractFlows(
      syntacticAbstractFlows,
      storageCanariesEntries,
      verifHarReader
    );
    verifSites = new Set(
      verifHarReader.entries().map((entry) => getSiteByUrl(entry.request.url))
    );
  } else {
    const processed = processFlows({
      analysisName,
      auxConnectResult: staResult.aux.connectResult,
      preConnectResult: staResult.pre.connectResult,
      taintHarFile: staResult.taint.harFile,
      taintTaintFile: staResult.taint.taintFile,
    });
    taintAbstractFlows = processed.taintAbstractFlows;
    syntacticAbstractFlows = processed.syntacticAbstractFlows;
    const storageCanariesEntries = processed.storageCanariesEntries;
    trueSyntacticAbstractFlows = [];
    writeOutputFileSync(
      path.join(outputName, `${siteName}+TF.json`),
      Flatted.stringify(taintAbstractFlows)
    );
    writeOutputFileSync(
      path.join(outputName, `${siteName}+SF.json`),
      Flatted.stringify(syntacticAbstractFlows)
    );
    writeOutputFileSync(
      path.join(outputName, `${siteName}+C.json`),
      Flatted.stringify(storageCanariesEntries)
    );
  }

  const firstParty = getSiteByUrl(staResult.taint.connectResult.landingPageUrl);
  const toThirdPartyAggregateFlows = (
    abstractFlows: AbstractFlow[]
  ): AggregateFlow[] =>
    toAggregateFlows(abstractFlows).filter(
      ({ receiverSite }) => receiverSite !== firstParty
    );

  const taintFlows = toThirdPartyAggregateFlows(taintAbstractFlows);
  const syntacticFlows = toThirdPartyAggregateFlows(syntacticAbstractFlows);

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

  const trueOnlySyntacticFlows = _.intersectionWith(
    toAggregateFlows(trueSyntacticAbstractFlows),
    onlySyntacticFlows,
    _.isEqual
  );

  const unverifiedOnlySyntacticFlows = _.differenceWith(
    onlySyntacticFlows,
    trueOnlySyntacticFlows,
    _.isEqual
  );
  const ffOnlySyntacticFlows = unverifiedOnlySyntacticFlows.filter((flow) =>
    verifSites.has(flow.receiverSite)
  );
  const unknownOnlySyntacticFlows = _.difference(
    unverifiedOnlySyntacticFlows,
    ffOnlySyntacticFlows
  );

  writeOutputFileSync(
    path.join(outputName, `${siteName}.json`),
    JSON.stringify({
      site: siteName,
      intersectFlows: toReportFlows(intersectFlows, taintAbstractFlows),
      onlyTaintFlows: toReportFlows(onlyTaintFlows, taintAbstractFlows),
      onlySyntacticFlows: toReportFlows(
        onlySyntacticFlows,
        syntacticAbstractFlows
      ),
      trueOnlySyntacticFlows: toReportFlows(
        trueOnlySyntacticFlows,
        trueSyntacticAbstractFlows
      ),
      unknownOnlySyntacticFlows,
    })
  );

  return {
    intersectFlowsCount: intersectFlows.length,
    onlyTaintFlowsCount: onlyTaintFlows.length,
    onlySyntacticFlowsCount: onlySyntacticFlows.length,
    trueOnlySyntacticFlowsCount: trueOnlySyntacticFlows.length,
    syntacticFlowsCount: intersectFlows.length + onlySyntacticFlows.length,
    trueSyntacticFlowsCount:
      intersectFlows.length + trueOnlySyntacticFlows.length,

    intersectFlowsSitesCount: Number(intersectFlows.length > 0),
    onlyTaintFlowsSitesCount: Number(onlyTaintFlows.length > 0),
    onlySyntacticFlowsSitesCount: Number(onlySyntacticFlows.length > 0),
    trueOnlySyntacticFlowsSitesCount: Number(trueOnlySyntacticFlows.length > 0),
    syntacticFlowsSitesCount: Number(
      intersectFlows.length > 0 || onlySyntacticFlows.length > 0
    ),
    trueSyntacticFlowsSitesCount: Number(
      intersectFlows.length > 0 || trueOnlySyntacticFlows.length > 0
    ),
  };
}

function toReportFlows(flows: AggregateFlow[], abstractFlows: AbstractFlow[]) {
  return flows.map((flow) => {
    const { receiverSite } = flow;
    const groupAbstractFlows = abstractFlows.filter((abstractFlow) =>
      _.isEqual(toAggregateFlow(abstractFlow), flow)
    );

    const matches = _.uniqWith(
      groupAbstractFlows.map(({ storageItem: { id } }) => id),
      _.isEqual
    ).map((storageId) => {
      const { storageType, key } = storageId;
      return {
        storageId: `${storageType}:${key}`,
        matches: groupAbstractFlows
          .filter(({ storageItem }) => _.isEqual(storageItem.id, storageId))
          .flatMap(({ matches }) => matches)
          .map(({ storageToken, requestToken }) => ({
            storageToken: truncateValuesInOperationToken(storageToken),
            requestToken: truncateValuesInOperationToken(requestToken),
          })),
      };
    });

    return {
      receiverSite,
      matches,
    };
  });
}
