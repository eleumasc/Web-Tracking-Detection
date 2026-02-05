import _ from "lodash";
import detectIdentifiableStorageItems from "../identifierDetection/detectIdentifiableStorageItems";
import FoxhoundTaintArchive from "../../foxhound/FoxhoundTaintArchive";
import path from "path";
import { computeTaintedRequests } from "./TaintedRequest";
import { getOutputPath, writeOutputFileSync } from "../../data/outputDir";
import { getStorageItemsFromStorageState } from "../StorageItem";
import { Har } from "../../util/Har";
import { StatefulTrackingAnalysisResult } from "../AnalysisResult";

export function doTestComputeTaintedRequests(args: {
  site: string;
  analysisName: string;
  outputName: string;
  staResult: StatefulTrackingAnalysisResult;
}) {
  const { site, analysisName, outputName, staResult } = args;

  const auxConnectResult = staResult.aux.connectResult;
  const preConnectResult = staResult.pre.connectResult;
  const taintHarFile = staResult.taint.harFile;
  const taintTaintFile = staResult.taint.taintFile;

  const identifiers = detectIdentifiableStorageItems(
    getStorageItemsFromStorageState(preConnectResult.storageState),
    getStorageItemsFromStorageState(auxConnectResult.storageState),
  );
  const taintHar = new Har(
    path.join(getOutputPath(analysisName), taintHarFile),
  );
  const taintFoxReports = new FoxhoundTaintArchive(
    path.join(getOutputPath(analysisName), taintTaintFile),
  ).getReports();

  const taintedRequests = computeTaintedRequests(
    taintFoxReports,
    identifiers,
    taintHar,
  );

  writeOutputFileSync(
    path.join(outputName, `${site}.json`),
    JSON.stringify({
      site,
      taintedRequests,
    }),
  );

  return {
    taintedRequestsCount: taintedRequests.length,
  };
}
