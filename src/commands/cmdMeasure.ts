import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import FoxhoundTaintStore from "../foxhound/FoxhoundTaintStore";
import matchIdentifiers from "../core/chen/matchIdentifiers";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { enumerate as iterEnumerate } from "iter-tools";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getStorageItemsFromStorageState } from "../core/StorageItem";
import { HarController } from "../util/HarController";
import { isFailure } from "../util/Completion";
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
    const site = analysisDocument.name;
    console.log(site, documentIndex);

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

    const auxStorageItems = getStorageItemsFromStorageState(
      ctaResult.aux.connectResult.storageState
    );
    const preStorageItems = getStorageItemsFromStorageState(
      ctaResult.pre.connectResult.storageState
    );

    const harController = new HarController(
      path.join(getOutputPath(analysisCollection.name), ctaResult.taint.harFile)
    );

    const taintAbstractFlows = getTaintAbstractFlows(
      foxhoundReports,
      harController
    );
    const syntacticAbstractFlows = getSyntacticAbstractFlows(
      preStorageItems,
      harController,
      journeySyntacticMatcher
    );

    const identifiers = matchIdentifiers(preStorageItems, auxStorageItems);
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

    type AggregateFlow = {
      itemId: string;
      receiverOrigin: string;
    };

    const toAggregateFlows = (abstractFlows: AbstractFlow[]): AggregateFlow[] =>
      _.uniqWith(
        abstractFlows.map(({ itemId, receiverOrigin }) => ({
          itemId,
          receiverOrigin,
        })),
        _.isEqual
      );

    const taintFlows = toAggregateFlows(
      prefilterAbstractFlows(taintAbstractFlows)
    );
    const syntacticFlows = toAggregateFlows(
      prefilterAbstractFlows(syntacticAbstractFlows)
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
        const { itemId, receiverOrigin } = flow;
        const groupAbstractFlows = abstractFlows.filter(
          (af) => af.itemId === itemId && af.receiverOrigin === receiverOrigin
        );
        const storageValues = _.uniq(
          groupAbstractFlows.map((x) => x.storageValue)
        );
        const requestValues = _.uniq(
          groupAbstractFlows.map((x) => x.requestValue)
        );
        return {
          itemId,
          receiverOrigin,
          storageValues,
          requestValues,
        };
      });

    writeOutputFileSync(
      path.join(outputName, `${site}.json`),
      JSON.stringify({
        site,
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
