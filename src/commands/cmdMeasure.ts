import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import isLoEqual from "../util/isLoEqual";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import zxcvbn from "zxcvbn";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { enumerate as iterEnumerate } from "iter-tools";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getStorageOperationsFromTaintReports } from "../core/AbstractFlow";
import { HarController } from "../util/HarController";
import { isFailure } from "../util/Completion";
import { TaintReport } from "../foxhound/types";
import {
  getSyntacticStorageFlowHistory,
  getTaintStorageFlowHistory,
  StorageFlow,
  syntacticMatchCookieguard,
  syntacticMatchJourney,
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

    // const storageWrites = storageOperations.filter(
    //   ({ type }) => type === "Write"
    // );

    const taintHistory = getTaintStorageFlowHistory(
      taintReports,
      harController
    );
    const syntacticHistory = getSyntacticStorageFlowHistory(
      storageOperations,
      harController,
      syntacticMatchJourney
    );

    type AggregateStorageFlow = {
      itemId: string;
      receiverOrigin: string;
      _storageValues: string[];
      _requestValues: string[];
      _stgValCharsSent: string[];
    };

    const toAggregateStorageFlows = (
      storageFlows: StorageFlow[]
    ): AggregateStorageFlow[] =>
      _.values(
        _.groupBy(storageFlows, ({ itemId, receiverOrigin }) =>
          JSON.stringify({ itemId, receiverOrigin })
        )
      ).map((keyGroup): AggregateStorageFlow => {
        const { itemId, receiverOrigin } = keyGroup[0];
        return {
          itemId,
          receiverOrigin,
          _storageValues: _.uniq(keyGroup.map((x) => x.storageValue)),
          _requestValues: _.uniq(keyGroup.map((x) => x.requestValue)),
          _stgValCharsSent: _.uniq(keyGroup.map((x) => x.stgValCharsSent)),
        };
      });

    // Prefilter flows using the zxcvbn technique from Journey
    // Taint flows: information about distinct characters (positions) is in taint information
    // Syntactic flows: since whole substrings are matched, every character (position) is distinct
    const zxcvbnCheckCache = new Map<string, boolean>();
    const prefilterStorageFlows = (
      storageFlows: StorageFlow[]
    ): StorageFlow[] =>
      storageFlows.filter(({ stgValCharsSent: stgValCharsSent }) => {
        const zxcvbnCheck =
          zxcvbnCheckCache.get(stgValCharsSent) ??
          (stgValCharsSent.length >= 128 ||
            zxcvbn(stgValCharsSent).guesses_log10 >= 9);
        zxcvbnCheckCache.set(stgValCharsSent, zxcvbnCheck);
        return zxcvbnCheck;
      });

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
