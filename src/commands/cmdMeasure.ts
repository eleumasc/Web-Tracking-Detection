import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import FoxhoundTaintStore from "../foxhound/FoxhoundTaintStore";
import matchIdentifiers from "../core/chen/matchIdentifiers";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import zxcvbn from "zxcvbn";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { enumerate as iterEnumerate } from "iter-tools";
import { FoxhoundReport } from "../foxhound/types";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { HarController } from "../util/HarController";
import { isFailure } from "../util/Completion";
import { jsView } from "../core/StorageState";
import {
  getStorageItemsFromStorageState,
  StorageItem,
} from "../core/StorageItem";
import {
  getSyntacticAbstractFlows,
  getTaintAbstractFlows,
  AbstractFlow,
  journeySyntacticMatcher,
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
    const siteName = analysisDocument.name;
    console.log(siteName, documentIndex);

    totalSitesCount += 1;

    const analysisLogEntry = store.getDocumentData<AnalysisLogEntry>(
      analysisDocument.id
    );

    if (isFailure(analysisLogEntry)) continue;
    const { value: ctaResult } = analysisLogEntry;

    successSitesCount += 1;

    const foxhoundReports = FoxhoundTaintStore.open(
      path.join(
        getOutputPath(analysisCollection.name),
        ctaResult.taint.taintFile
      )
    ).getReports();

    const harController = new HarController(
      path.join(getOutputPath(analysisCollection.name), ctaResult.taint.harFile)
    );

    const auxStorageItems = getStorageItemsFromStorageState(
      jsView(ctaResult.aux.connectResult.storageState)
    );
    const preStorageItems = getStorageItemsFromStorageState(
      jsView(ctaResult.pre.connectResult.storageState)
    );

    const {
      taintAbstractFlows,
      syntacticAbstractFlows,
      taintFlows,
      syntacticFlows,
    } = getAbstractAndAggregateFlows(
      auxStorageItems,
      preStorageItems,
      foxhoundReports,
      harController
    );

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

    const toOutputFlows = (
      flows: AggregateFlow[],
      abstractFlows: AbstractFlow[]
    ) =>
      flows.map((flow) => {
        const { storageId, receiverOrigin } = flow;
        const groupAbstractFlows = abstractFlows.filter(
          (af) =>
            _.isEqual(af.storageItem.id, storageId) &&
            af.receiverOrigin === receiverOrigin
        );
        const storageValues = _.uniq(
          groupAbstractFlows.map((x) => x.storageItem.value)
        );
        const requestValues = _.uniq(
          groupAbstractFlows.map((x) => x.requestValue)
        );
        return {
          storageId: `${storageId.storageType}:${storageId.key}`,
          receiverOrigin,
          storageValues,
          requestValues,
        };
      });

    writeOutputFileSync(
      path.join(outputName, `${siteName}.json`),
      JSON.stringify({
        site: siteName,
        intersectFlows: toOutputFlows(intersectFlows, taintAbstractFlows),
        onlyTaintFlows: toOutputFlows(onlyTaintFlows, taintAbstractFlows),
        onlySyntacticFlows: toOutputFlows(
          onlySyntacticFlows,
          syntacticAbstractFlows
        ),
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

export type AggregateFlow = {
  storageId: StorageItem["id"];
  receiverOrigin: string;
};

export function getAbstractAndAggregateFlows(
  auxStorageItems: StorageItem[],
  preStorageItems: StorageItem[],
  taintFoxhoundReports: FoxhoundReport[],
  taintHarController: HarController
) {
  const filterStorageItemsUsingZxcvbn = (storageItems: StorageItem[]) =>
    storageItems.filter(
      ({ value }) => value.length >= 128 || zxcvbn(value).guesses_log10 >= 9
    );
  const identifiers = filterStorageItemsUsingZxcvbn(
    matchIdentifiers(preStorageItems, auxStorageItems)
  );

  const taintAbstractFlows = getTaintAbstractFlows(
    taintFoxhoundReports,
    identifiers,
    taintHarController
  );
  const syntacticAbstractFlows = getSyntacticAbstractFlows(
    identifiers,
    taintHarController,
    journeySyntacticMatcher
  );

  const toAggregateFlows = (abstractFlows: AbstractFlow[]): AggregateFlow[] => {
    return _.uniqWith(
      abstractFlows.map(({ storageItem, receiverOrigin }) => ({
        storageId: storageItem.id,
        receiverOrigin,
      })),
      _.isEqual
    );
  };

  const taintFlows = toAggregateFlows(taintAbstractFlows);
  const syntacticFlows = toAggregateFlows(syntacticAbstractFlows);

  return {
    taintAbstractFlows,
    syntacticAbstractFlows,
    taintFlows,
    syntacticFlows,
  };
}
