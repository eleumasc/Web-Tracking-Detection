import detectIdentifiableStorageItems from "./identifierDetection/detectIdentifiableStorageItems";
import FoxTaintArchive from "../foxhound/FoxTaintArchive";
import path from "path";
import { createModifiedStorageItems } from "./syntacticMatching/createModifiedStorageItems";
import { getOutputPath } from "../data/outputDir";
import { getStorageItemsFromStorageState } from "./StorageItem";
import { getSyntacticFlows } from "./syntacticMatching/getSyntacticFlows";
import { getTaintFlows } from "./taintTracking/getTaintFlows";
import { Har } from "../util/Har";
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
  const taintHar = new Har(
    path.join(getOutputPath(analysisName), taintHarFile),
  );
  const taintFoxReports = new FoxTaintArchive(
    path.join(getOutputPath(analysisName), taintTaintFile),
  ).getReports();
  const taintFlows = getTaintFlows(
    taintFoxReports,
    identifiers,
    taintHar,
  );
  const syntacticFlows = getSyntacticFlows(identifiers, taintHar);
  const modifiedStorageItems = createModifiedStorageItems(syntacticFlows);

  return {
    taintFlows,
    syntacticFlows,
    modifiedStorageItems,
  };
}
