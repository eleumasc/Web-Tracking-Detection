import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import isLoEqual from "../util/isLoEqual";
import matchIdentifiers from "../chen/matchIdentifiers";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { enumerate as iterEnumerate } from "iter-tools";
import { FoxhoundReport } from "../foxhound/types";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getStorageOperationsFromFoxhoundReports } from "../core/TaintFlow";
import { HarController } from "../util/HarController";
import { isFailure } from "../util/Completion";
import {
  getSyntacticAbstractFlows,
  getTaintAbstractFlows,
  AbstractFlow,
  syntacticMatchCookieguard,
  syntacticMatchJourney,
} from "../core/AbstractFlow";

export default function cmdMeasure(args: { analysisId: number }) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);

  const outputName = `${currentTime()}-Measure-${analysisId}`;

  let totalSitesCount = 0;
  let successSitesCount = 0;

  let syntacticFlowsCount = 0;
  let intersectFlowsCount = 0;
  let onlyTaintFlowsCount = 0;
  let onlySyntacticFlowsCount = 0;

  let syntacticFlowsSitesCount = 0;
  let intersectFlowsSitesCount = 0;
  let onlyTaintFlowsSitesCount = 0;
  let onlySyntacticFlowsSitesCount = 0;

  for (const [documentIndex, analysisDocument] of iterEnumerate(
    store.getDocumentsByCollection(analysisCollection.id)
  )) {
    const site = analysisDocument.name;
    console.log(site, documentIndex);

    totalSitesCount += 1;

    const analysisLogEntry = store.getDocumentData<AnalysisLogEntry>(
      analysisDocument.id
    );

    if (isFailure(analysisLogEntry)) continue;
    const { value: ctaResult } = analysisLogEntry;

    successSitesCount += 1;

    const foxhoundReports = (() => {
      const taintReportsCollection = store.getCollectionByName(
        analysisCollection.id,
        `taintReports:${site}`
      );
      return store
        .getDocumentsWithDataByCollection<FoxhoundReport>(
          taintReportsCollection.id
        )
        .map(({ data }) => data);
    })();
    ctaResult.taintReports = foxhoundReports;

    const storageOperations =
      getStorageOperationsFromFoxhoundReports(foxhoundReports);

    const harController = new HarController(
      path.join(getOutputPath(analysisCollection.name), ctaResult.harFile)
    );

    // const storageWrites = storageOperations.filter(
    //   ({ type }) => type === "Write"
    // );

    const taintAbstractFlows = getTaintAbstractFlows(
      foxhoundReports,
      harController
    );
    const syntacticAbstractFlows = getSyntacticAbstractFlows(
      storageOperations,
      harController,
      syntacticMatchJourney
    );

    type AggregateFlow = {
      itemId: string;
      receiverOrigin: string;
      _storageValues: string[];
      _requestValues: string[];
      _stgValCharsSent: string[];
    };

    const toAggregateFlows = (abstractFlows: AbstractFlow[]): AggregateFlow[] =>
      _.values(
        _.groupBy(abstractFlows, ({ itemId, receiverOrigin }) =>
          JSON.stringify([itemId, receiverOrigin])
        )
      ).map((keyGroup): AggregateFlow => {
        const { itemId, receiverOrigin } = keyGroup[0];
        return {
          itemId,
          receiverOrigin,
          _storageValues: _.uniq(keyGroup.map((x) => x.storageValue)),
          _requestValues: _.uniq(keyGroup.map((x) => x.requestValue)),
          _stgValCharsSent: _.uniq(keyGroup.map((x) => x.stgValCharsSent)),
        };
      });

    const identifiers = matchIdentifiers(
      ctaResult.preStorageState,
      ctaResult.firstStorageState
    );
    const prefilterAbstractFlows = (
      abstractFlows: AbstractFlow[]
    ): AbstractFlow[] =>
      abstractFlows.filter(({ itemId, storageValue }) => {
        // Prefilter flows based on the persisted value of identifiers
        return identifiers.find(({ key: identKey, value: identValue }) => {
          const identItemId = `${identKey.storageType}:${identKey.name}`;
          return itemId === identItemId && storageValue === identValue;
        });
      });

    const taintFlows = toAggregateFlows(
      prefilterAbstractFlows(taintAbstractFlows)
    );
    const syntacticFlows = toAggregateFlows(
      prefilterAbstractFlows(syntacticAbstractFlows)
    );

    const intersectFlows = _.intersectionWith(
      taintFlows,
      syntacticFlows,
      isLoEqual
    );
    const onlyTaintFlows = _.differenceWith(
      taintFlows,
      syntacticFlows,
      isLoEqual
    );
    const onlySyntacticFlows = _.differenceWith(
      syntacticFlows,
      taintFlows,
      isLoEqual
    );

    writeOutputFileSync(
      path.join(outputName, `${site}.json`),
      JSON.stringify({
        site,
        // storageWrites,
        intersectFlows,
        onlyTaintFlows,
        onlySyntacticFlows,
      })
    );

    syntacticFlowsCount += syntacticFlows.length;
    intersectFlowsCount += intersectFlows.length;
    onlyTaintFlowsCount += onlyTaintFlows.length;
    onlySyntacticFlowsCount += onlySyntacticFlows.length;

    syntacticFlowsSitesCount += Number(syntacticFlows.length > 0);
    intersectFlowsSitesCount += Number(intersectFlows.length > 0);
    onlyTaintFlowsSitesCount += Number(onlyTaintFlows.length > 0);
    onlySyntacticFlowsSitesCount += Number(onlySyntacticFlows.length > 0);
  }

  const report = {
    totalSitesCount,
    successSitesCount,
    syntacticFlowsCount,
    intersectFlowsCount,
    onlyTaintFlowsCount,
    onlySyntacticFlowsCount,
    taintEnhancement: onlyTaintFlowsCount / syntacticFlowsCount,
    syntacticFlowsSitesCount,
    intersectFlowsSitesCount,
    onlyTaintFlowsSitesCount,
    onlySyntacticFlowsSitesCount,
    taintEnhancementSites: onlyTaintFlowsSitesCount / syntacticFlowsSitesCount,
  };
  console.log(report);
  writeOutputFileSync(
    path.join(outputName, "report.json"),
    JSON.stringify(report)
  );

  process.exit(0);
}
