import detectIdentifiableStorageItems from "./identifierDetection/detectIdentifiableStorageItems";
import FoxhoundTaintArchive from "../foxhound/FoxhoundTaintArchive";
import path from "path";
import { computeCanaries } from "./syntacticMatching/computeCanaries";
import { getOutputPath } from "../data/outputDir";
import { getStorageItemsFromStorageState } from "./StorageItem";
import { getSyntacticFlows } from "./syntacticMatching/getSyntacticFlows";
import { getTaintFlows } from "./taintTracking/getTaintFlows";
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
    getStorageItemsFromStorageState(auxConnectResult.storageState),
  );
  const taintHarReader = new HarReader(
    path.join(getOutputPath(analysisName), taintHarFile),
  );
  const taintFoxhoundReports = new FoxhoundTaintArchive(
    path.join(getOutputPath(analysisName), taintTaintFile),
  ).getReports();
  const taintFlows = getTaintFlows(
    taintFoxhoundReports,
    identifiers,
    taintHarReader,
  );
  const syntacticFlows = getSyntacticFlows(identifiers, taintHarReader);
  const storageCanariesEntries = computeCanaries(syntacticFlows);

  return {
    taintFlows,
    syntacticFlows,
    storageCanariesEntries,
  };
}
