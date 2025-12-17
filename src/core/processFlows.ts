import computeStorageCanariesEntries from "./syntacticMatching/computeStorageCanariesEntries";
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
    storageTransformTreeEntries: taintStorageTransformTreeEntries,
  } = getSyntacticAbstractFlows(identifiers, taintHarReader);
  const storageCanariesEntries = computeStorageCanariesEntries(
    taintStorageTransformTreeEntries
  );

  return {
    taintAbstractFlows,
    syntacticAbstractFlows,
    storageCanariesEntries,
  };
}
