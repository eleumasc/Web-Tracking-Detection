import computeCanariesForVerif from "./syntacticMatching/computeCanariesForVerif";
import detectIdentifiableStorageItems from "./identifierDetection/detectIdentifiableStorageItems";
import FoxhoundTaintArchive from "../foxhound/FoxhoundTaintArchive";
import path from "path";
import { getOutputPath } from "../data/outputDir";
import { getStorageItemsFromStorageState } from "./StorageItem";
import { getSyntacticAbstractFlows } from "./syntacticMatching/getSyntacticAbstractFlows";
import { getTaintAbstractFlows } from "./taintTracking/getTaintAbstractFlows";
import { HarReader } from "../util/HarReader";
import { SimulateConnectResult } from "./simulateConnect";

export function processFlows(args: {
  analysisName: string;
  auxConnectResult: SimulateConnectResult;
  preConnectResult: SimulateConnectResult;
  taintHarFile: string;
  taintTaintFile: string;
}) {
  const {
    analysisName,
    auxConnectResult,
    preConnectResult,
    taintHarFile,
    taintTaintFile,
  } = args;

  const identifiers = detectIdentifiableStorageItems(
    getStorageItemsFromStorageState(preConnectResult.storageState),
    getStorageItemsFromStorageState(auxConnectResult.storageState)
  );
  const taintHarReader = new HarReader(
    path.join(getOutputPath(analysisName), taintHarFile)
  );
  const taintFoxhoundReports = new FoxhoundTaintArchive(
    path.join(getOutputPath(analysisName), taintTaintFile)
  ).getReports();
  const { abstractFlows: taintAbstractFlows } = getTaintAbstractFlows(
    taintFoxhoundReports,
    identifiers,
    taintHarReader
  );
  const {
    abstractFlows: syntacticAbstractFlows,
    storageDerivationEntries: taintStorageDerivationEntries,
  } = getSyntacticAbstractFlows(identifiers, taintHarReader);
  const storageCanariesEntries = computeCanariesForVerif(
    taintStorageDerivationEntries
  );

  return {
    taintAbstractFlows,
    syntacticAbstractFlows,
    storageCanariesEntries,
  };
}
