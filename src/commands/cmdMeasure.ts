import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
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
  StorageFlowHistory,
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

    const digestHistory = (history: StorageFlowHistory) =>
      _.values(_.groupBy(history, (x) => x.itemId));

    const digestedTaintHistory = digestHistory(taintHistory);
    if (digestedTaintHistory.length !== 0) {
      writeOutputFileSync(
        path.join(outputName, `${site}.Td.json`),
        JSON.stringify({ site, taintHistory: digestedTaintHistory })
      );
    }
    const digestedSyntacticHistory = digestHistory(syntacticHistory);
    if (digestedSyntacticHistory.length !== 0) {
      writeOutputFileSync(
        path.join(outputName, `${site}.Sd.json`),
        JSON.stringify({ site, syntacticHistory: digestedSyntacticHistory })
      );
    }

    const toUniqStorageFlows = (history: StorageFlowHistory) =>
      _.uniqBy(history, (x) => JSON.stringify(x));

    const taintFlows = toUniqStorageFlows(taintHistory);
    const syntacticFlows = toUniqStorageFlows(syntacticHistory);

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
    writeOutputFileSync(
      path.join(outputName, `${site}.json`),
      JSON.stringify({
        site,
        storageWrites,
        intersectFlows,
        onlyTaintFlows,
        onlySyntacticFlows,
      })
    );

    syntacticFlowsCount += syntacticFlows.length;
    onlyTaintFlowsCount += onlyTaintFlows.length;
  }

  const report = {
    totalSitesCount,
    successSitesCount,
    syntacticFlowsCount,
    onlyTaintFlowsCount,
    taintEnhancement: onlyTaintFlowsCount / syntacticFlowsCount,
  };
  console.log(report);
  writeOutputFileSync(
    path.join(outputName, "report.json"),
    JSON.stringify(report)
  );

  process.exit(0);
}
