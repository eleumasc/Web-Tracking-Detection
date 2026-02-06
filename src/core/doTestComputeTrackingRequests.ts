import _ from "lodash";
import detectIdentifiableStorageItems from "./identifierDetection/detectIdentifiableStorageItems";
import FoxTaintArchive from "../foxhound/FoxTaintArchive";
import path from "path";
import { computeMatchedRequests } from "./syntacticMatching/MatchedRequest";
import { computeTaintedRequests } from "./taintTracking/TaintedRequest";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getSiteFromUrl } from "../util/site";
import { getStorageItemsFromStorageState } from "./StorageItem";
import { Har } from "../util/Har";
import { StatefulTrackingAnalysisResult } from "./AnalysisResult";

export function doTestComputeTrackingRequests(args: {
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
  const taintFoxReports = new FoxTaintArchive(
    path.join(getOutputPath(analysisName), taintTaintFile),
  ).getReports();

  const pageUrl = staResult.taint.connectResult.landingPageUrl;
  const firstParty = getSiteFromUrl(pageUrl);
  const filterThirdPartyRequests = <T extends { url: string }>(
    requests: T[],
  ): T[] =>
    requests.filter((request) => getSiteFromUrl(request.url) !== firstParty);

  const taintedRequests = filterThirdPartyRequests(
    computeTaintedRequests(taintFoxReports, identifiers, taintHar),
  );

  const matchedRequests = filterThirdPartyRequests(
    computeMatchedRequests(identifiers, taintHar),
  );

  writeOutputFileSync(
    path.join(outputName, `${site}+TR.json`),
    JSON.stringify({
      site,
      taintedRequests,
    }),
  );
  writeOutputFileSync(
    path.join(outputName, `${site}+SR.json`),
    JSON.stringify({
      site,
      matchedRequests,
    }),
  );

  return {
    taintedRequestsCount: taintedRequests.length,
    matchedRequestsCount: matchedRequests.length,
  };
}
