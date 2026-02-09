import detectIdentifiableStorageItems from "./identifierDetection/detectIdentifiableStorageItems";
import FoxTaintArchive from "../foxhound/FoxTaintArchive";
import path from "path";
import { computeSyntacticRequests } from "./syntacticMatching/SyntacticRequest";
import { computeTaintRequests } from "./taintTracking/TaintRequest";
import { createModifiedStorageItems } from "./syntacticMatching/createModifiedStorageItems";
import { getOutputPath } from "../data/outputDir";
import { getSiteFromUrl } from "../util/site";
import { getStorageItemsFromStorageState } from "./StorageItem";
import { Har } from "../util/Har";
import { Request } from "./Request";
import { StatefulTrackingAnalysisResult } from "./AnalysisResult";

export function computeUnverifiedTrackingRequests(args: {
  analysisName: string;
  staResult: StatefulTrackingAnalysisResult;
}) {
  const { analysisName, staResult } = args;
  const auxConnectResult = staResult.aux.connectResult;
  const preConnectResult = staResult.pre.connectResult;
  const taintHarFile = staResult.taint.harFile;
  const taintTaintFile = staResult.taint.taintFile;

  const identifiers = detectIdentifiableStorageItems(
    getStorageItemsFromStorageState(preConnectResult.storageState),
    getStorageItemsFromStorageState(auxConnectResult.storageState),
  );

  const har = new Har(path.join(getOutputPath(analysisName), taintHarFile));
  const foxReports = new FoxTaintArchive(
    path.join(getOutputPath(analysisName), taintTaintFile),
  ).getReports();

  const pageUrl = staResult.taint.connectResult.landingPageUrl;
  const firstParty = getSiteFromUrl(pageUrl);
  const filterThirdPartyRequests = <T extends Request>(requests: T[]): T[] =>
    requests.filter((request) => getSiteFromUrl(request.url) !== firstParty);

  const taintRequests = filterThirdPartyRequests(
    computeTaintRequests(foxReports, identifiers, har),
  );
  const syntacticRequests = filterThirdPartyRequests(
    computeSyntacticRequests(identifiers, har),
  );

  const modifiedStorageItems = createModifiedStorageItems(syntacticRequests);

  return {
    taintRequests,
    syntacticRequests,
    modifiedStorageItems,
  };
}
