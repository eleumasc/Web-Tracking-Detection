import alterStorageTransformTreeEntries from "./syntacticMatching/alterStorageTransformTreeEntries";
import detectIdentifiers from "./identifierDetection/detectIdentifiers";
import FoxhoundTaintArchive from "../foxhound/FoxhoundTaintArchive";
import path from "path";
import { extractStorageCanariesEntries } from "./syntacticMatching/verifySyntacticAbstractFlows";
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

  const identifiers = detectIdentifiers(
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
    storageTransformTreeEntries: taintStorageTransformTreeEntries,
  } = getSyntacticAbstractFlows(identifiers, taintHarReader);
  const verifStorageTransformTreeEntries = alterStorageTransformTreeEntries(
    taintStorageTransformTreeEntries
  );
  const storageCanariesEntries = extractStorageCanariesEntries(
    verifStorageTransformTreeEntries
  );

  return {
    taintAbstractFlows,
    syntacticAbstractFlows,
    storageCanariesEntries,
  };
}
