import alterStorageTransformTreeEntries from "./syntacticMatching/alterStorageTransformTreeEntries";
import detectIdentifiers from "./identifierDetection/detectIdentifiers";
import FoxhoundTaintStore from "../foxhound/FoxhoundTaintStore";
import path from "path";
import { extractStorageIdentifiablesEntries } from "./syntacticMatching/verifySyntacticAbstractFlows";
import { getOutputPath } from "../data/outputDir";
import { getStorageItemsFromStorageState } from "./StorageItem";
import { getSyntacticAbstractFlows } from "./syntacticMatching/getSyntacticAbstractFlows";
import { getTaintAbstractFlows } from "./taintTracking/getTaintAbstractFlows";
import { HarController } from "../util/HarController";
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

  const identifiers = detectIdentifiers(
    getStorageItemsFromStorageState(preConnectResult.storageState),
    getStorageItemsFromStorageState(auxConnectResult.storageState)
  );
  const taintHarController = new HarController(
    path.join(getOutputPath(analysisName), taintHarFile)
  );
  const taintFoxhoundReports = FoxhoundTaintStore.open(
    path.join(getOutputPath(analysisName), taintTaintFile)
  ).getReports();
  const { abstractFlows: taintAbstractFlows } = getTaintAbstractFlows(
    taintFoxhoundReports,
    identifiers,
    taintHarController
  );
  const {
    abstractFlows: syntacticAbstractFlows,
    storageTransformTreeEntries: taintStorageTransformTreeEntries,
  } = getSyntacticAbstractFlows(identifiers, taintHarController);
  const verifStorageTransformTreeEntries = alterStorageTransformTreeEntries(
    taintStorageTransformTreeEntries
  );
  const verifStorageIdentifiablesEntries = extractStorageIdentifiablesEntries(
    verifStorageTransformTreeEntries
  );

  return {
    taintAbstractFlows,
    syntacticAbstractFlows,
    verifStorageIdentifiablesEntries,
  };
}
