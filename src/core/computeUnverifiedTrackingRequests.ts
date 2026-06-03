import detectIdentifiableStorageItems from "./identifierDetection/detectIdentifiableStorageItems";
import FoxTaintArchive from "../foxhound/FoxTaintArchive";
import { computeSyntacticRequests } from "./syntacticMatching/SyntacticRequest";
import { computeTaintRequests } from "./taintTracking/TaintRequest";
import { createCanaryStorageItems } from "./syntacticMatching/CanaryStorageItem";
import { getSiteFromUrl } from "../util/site";
import { getStorageItemsFromStorageState } from "./StorageItem";
import { Har } from "../util/Har";
import { makeDataPath } from "../data/path";
import { Request } from "./Request";
import { StatefulTrackingAnalysisResult } from "./AnalysisResult";
import { toArray } from "iter-tools";

export function computeUnverifiedTrackingRequests(args: {
  analyzeDataName: string;
  staResult: StatefulTrackingAnalysisResult;
}) {
  const { analyzeDataName, staResult } = args;
  const auxConnectResult = staResult.aux.connectResult;
  const preConnectResult = staResult.pre.connectResult;
  const taintHarFile = staResult.taint.harFile;
  const taintTaintFile = staResult.taint.taintFile;

  const identifiers = detectIdentifiableStorageItems(
    getStorageItemsFromStorageState(preConnectResult.storageState),
    getStorageItemsFromStorageState(auxConnectResult.storageState)
  );

  const har = new Har(makeDataPath(analyzeDataName, taintHarFile));
  const foxReports = toArray(
    FoxTaintArchive.open(
      makeDataPath(analyzeDataName, taintTaintFile)
    ).getReports()
  );

  const pageUrl = staResult.taint.connectResult.landingPageUrl;
  const firstParty = getSiteFromUrl(pageUrl);
  const filterThirdPartyRequests = <T extends Request>(requests: T[]): T[] =>
    requests.filter((request) => getSiteFromUrl(request.url) !== firstParty);

  const taintRequests = filterThirdPartyRequests(
    computeTaintRequests(foxReports, identifiers, har)
  );
  const syntacticRequests = filterThirdPartyRequests(
    computeSyntacticRequests(identifiers, har)
  );

  const canaryStorageItems = createCanaryStorageItems(syntacticRequests);

  return {
    taintRequests,
    syntacticRequests,
    canaryStorageItems,
  };
}
