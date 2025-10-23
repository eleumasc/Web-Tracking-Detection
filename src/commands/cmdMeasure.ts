import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import isLoEqual from "../util/isLoEqual";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { enumerate } from "iter-tools";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getStorageOperationsFromTaintReports } from "../core/AbstractFlow";
import { HarController } from "../util/HarController";
import { isFailure } from "../util/Completion";
import { TaintReport } from "../foxhound/types";
import {
  getSyntacticStorageFlowHistory,
  getTaintStorageFlowHistory,
  StorageFlow,
} from "../core/StorageFlowHistory";

export default function cmdMeasure(args: { analysisId: number }) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);

  const outputName = `${currentTime()}-Measure-${analysisId}`;

  let totalSitesCount = 0;
  let successSitesCount = 0;
  let syntacticFlowsCount = 0;
  let onlyTaintFlowsCount = 0;
  let syntacticFlowsSitesCount = 0;
  let onlyTaintFlowsSitesCount = 0;

  for (const [documentIndex, analysisDocument] of enumerate(
    store.getDocumentsByCollection(analysisCollection.id)
  )) {
    const site = analysisDocument.name;
    console.log(site, documentIndex);

    totalSitesCount += 1;

    const analysisLogEntry = store.getDocumentData<AnalysisLogEntry>(
      analysisDocument.id
    );

    if (isFailure(analysisLogEntry)) continue;

    successSitesCount += 1;

    const taintReports = (() => {
      const taintReportsCollection = store.getCollectionByName(
        analysisCollection.id,
        `taintReports:${site}`
      );
      return store
        .getDocumentsWithDataByCollection<TaintReport>(
          taintReportsCollection.id
        )
        .map(({ data }) => data);
    })();
    analysisLogEntry.value.taintReports = taintReports;

    const storageOperations =
      getStorageOperationsFromTaintReports(taintReports);
    const harController = new HarController(
      path.join(
        getOutputPath(analysisCollection.name),
        analysisLogEntry.value.harFile
      )
    );

    const storageWrites = storageOperations.filter(
      ({ type }) => type === "Write"
    );

    const taintHistory = getTaintStorageFlowHistory(taintReports);
    const syntacticHistory = getSyntacticStorageFlowHistory(
      storageOperations,
      harController.entries(),
      harController
    );

    type AggregateStorageFlow = {
      itemId: string;
      receiverOrigin: string;
      _values: string[]; // list of possible values that flowed from storage source to network sink
    };

    const toAggregateStorageFlows = (
      storageFlows: StorageFlow[]
    ): AggregateStorageFlow[] =>
      _.values(
        _.groupBy(storageFlows, ({ itemId, receiverOrigin }) =>
          JSON.stringify({ itemId, receiverOrigin })
        )
      ).map((keyGroup) => {
        const { itemId, receiverOrigin } = keyGroup[0];
        return {
          itemId,
          receiverOrigin,
          _values: _.uniq(keyGroup.map(({ value }) => value)),
        };
      });

    const prefilterStorageFlows = (
      storageFlows: StorageFlow[]
    ): StorageFlow[] => storageFlows.filter(({ value }) => value.length >= 8);

    const taintFlows = toAggregateStorageFlows(
      prefilterStorageFlows(taintHistory)
    );
    const syntacticFlows = toAggregateStorageFlows(
      prefilterStorageFlows(syntacticHistory)
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
    onlyTaintFlowsCount += onlyTaintFlows.length;

    syntacticFlowsSitesCount += Number(syntacticFlows.length > 0);
    onlyTaintFlowsSitesCount += Number(onlyTaintFlows.length > 0);
  }

  const report = {
    totalSitesCount,
    successSitesCount,
    syntacticFlowsCount,
    onlyTaintFlowsCount,
    taintEnhancement: onlyTaintFlowsCount / syntacticFlowsCount,
    syntacticFlowsSitesCount,
    onlyTaintFlowsSitesCount,
    taintEnhancementSites: onlyTaintFlowsSitesCount / syntacticFlowsSitesCount,
  };
  console.log(report);
  writeOutputFileSync(
    path.join(outputName, "report.json"),
    JSON.stringify(report)
  );

  process.exit(0);
}
