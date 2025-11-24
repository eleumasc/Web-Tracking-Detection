import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import FoxhoundTaintStore from "../foxhound/FoxhoundTaintStore";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import processTrueOnlySyntacticFlows from "../core/processTrueOnlySyntacticFlows";
import { AbstractFlow } from "../core/AbstractFlow";
import { AggregateFlow } from "../core/AggregateFlow";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { enumerate as iterEnumerate } from "iter-tools";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { HarController } from "../util/HarController";
import { isFailure } from "../util/Completion";
import { processFlows, processIdentifiers } from "../core/processFlows";
import {
  getStorageItemsFromStorageState,
  mergeStorageValues,
} from "../core/StorageItem";

export default function cmdMeasure(args: { analysisId: number }) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);

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

    const outputPath = getOutputPath(analysisCollection.name);

    const auxStorageItems = getStorageItemsFromStorageState(
      ctaResult.aux.connectResult.storageState
    );
    const preStorageItems = getStorageItemsFromStorageState(
      ctaResult.pre.connectResult.storageState
    );

    const foxhoundReports = FoxhoundTaintStore.open(
      path.join(outputPath, ctaResult.taint.taintFile)
    ).getReports();
    const harController = new HarController(
      path.join(outputPath, ctaResult.taint.harFile)
    );
    const identifiers = processIdentifiers(auxStorageItems, preStorageItems);
    const {
      taintAbstractFlows,
      syntacticAbstractFlows,
      taintFlows,
      syntacticFlows,
    } = processFlows(identifiers, foxhoundReports, harController);

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

    const { alteredStorageItems } = ctaResult.verif;
    const verifFoxhoundReports = FoxhoundTaintStore.open(
      path.join(outputPath, ctaResult.verif.taintFile)
    ).getReports();
    const verifHarController = new HarController(
      path.join(outputPath, ctaResult.verif.harFile)
    );
    const alteredIdentifiers = mergeStorageValues(
      identifiers,
      alteredStorageItems
    );
    const { syntacticAbstractFlows: verifSyntacticAbstractFlows } =
      processFlows(
        alteredIdentifiers,
        verifFoxhoundReports,
        verifHarController
      );
    const trueOnlySyntacticFlows = processTrueOnlySyntacticFlows(
      onlySyntacticFlows,
      verifSyntacticAbstractFlows,
      preStorageItems,
      alteredStorageItems
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
        trueOnlySyntacticFlows: toOutputFlows(
          trueOnlySyntacticFlows,
          verifSyntacticAbstractFlows
        ),
      })
    );

    intersectFlowsCount += intersectFlows.length;
    onlyTaintFlowsCount += onlyTaintFlows.length;
    onlySyntacticFlowsCount += onlySyntacticFlows.length;
    trueOnlySyntacticFlowsCount += trueOnlySyntacticFlows.length;
    syntacticFlowsCount += intersectFlows.length + onlySyntacticFlows.length;
    trueSyntacticFlowsCount +=
      intersectFlows.length + trueOnlySyntacticFlows.length;

    intersectFlowsSitesCount += Number(intersectFlows.length > 0);
    onlyTaintFlowsSitesCount += Number(onlyTaintFlows.length > 0);
    onlySyntacticFlowsSitesCount += Number(onlySyntacticFlows.length > 0);
    trueOnlySyntacticFlowsSitesCount += Number(
      trueOnlySyntacticFlows.length > 0
    );
    syntacticFlowsSitesCount += Number(
      intersectFlows.length > 0 || onlySyntacticFlows.length > 0
    );
    trueSyntacticFlowsSitesCount += Number(
      intersectFlows.length > 0 || trueOnlySyntacticFlows.length > 0
    );
  }

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
