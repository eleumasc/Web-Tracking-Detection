import _ from "lodash";
import Flatted from "flatted";
import path from "path";
import { Flow, SyntacticFlow, TaintFlow } from "./Flow";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getSiteFromUrl } from "../util/site";
import { Har } from "../util/Har";
import { processFlows } from "./processFlows";
import { readFileSync } from "fs";
import { StatefulTrackingAnalysisResult } from "./AnalysisResult";
import { verifySyntacticTrackingRequests } from "./syntacticMatching/verifySyntacticTrackingRequests";
import {
  TrackingRequest,
  TrackingIdEquivalence,
  viewSyntacticTrackingRequests,
  viewTaintTrackingRequests,
} from "./TrackingRequest";

export type SiteTrackingRequestsEntry = {
  site: string;
  pageUrl: string;
  requests: TrackingRequest[];
};

export function processTrackingRequests(args: {
  site: string;
  analysisName: string;
  outputName: string;
  staResult: StatefulTrackingAnalysisResult;
  forceNoVerif?: boolean;
}): SiteTrackingRequestsEntry {
  const { site, analysisName, outputName, staResult, forceNoVerif } = args;

  let taintFlows: TaintFlow[];
  let syntacticFlows: SyntacticFlow[];
  let doVerify;
  if (staResult.verif && !forceNoVerif) {
    taintFlows = Flatted.parse(
      readFileSync(
        path.join(getOutputPath(analysisName), staResult.verif.taintFlowsFile),
      ).toString(),
    );
    syntacticFlows = Flatted.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.syntacticFlowsFile,
        ),
      ).toString(),
    );
    const modifiedStorageItems = Flatted.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.modifiedStorageItemsFile,
        ),
      ).toString(),
    );
    doVerify = () =>
      verifySyntacticTrackingRequests(
        syntacticFlows,
        modifiedStorageItems,
        new Har(
          path.join(getOutputPath(analysisName), staResult.verif!.harFile),
        ),
        new Har(
          path.join(getOutputPath(analysisName), staResult.auxVerif!.harFile),
        ),
      );
  } else {
    const processed = processFlows({
      analysisName,
      auxConnectResult: staResult.aux.connectResult,
      preConnectResult: staResult.pre.connectResult,
      taintHarFile: staResult.taint.harFile,
      taintTaintFile: staResult.taint.taintFile,
    });
    taintFlows = processed.taintFlows;
    syntacticFlows = processed.syntacticFlows;
    const modifiedStorageItems = processed.modifiedStorageItems;
    writeOutputFileSync(
      path.join(outputName, `${site}+TF.json`),
      Flatted.stringify(taintFlows),
    );
    writeOutputFileSync(
      path.join(outputName, `${site}+SF.json`),
      Flatted.stringify(syntacticFlows),
    );
    writeOutputFileSync(
      path.join(outputName, `${site}+C.json`),
      Flatted.stringify(modifiedStorageItems),
    );
  }

  const pageUrl = staResult.taint.connectResult.landingPageUrl;
  const firstParty = getSiteFromUrl(pageUrl);
  const filterThirdPartyFlows = <T extends Flow>(flows: T[]): T[] =>
    flows.filter((flow) => getSiteFromUrl(flow.requestUrl) !== firstParty);
  taintFlows = filterThirdPartyFlows(taintFlows);
  syntacticFlows = filterThirdPartyFlows(syntacticFlows);

  let details: Record<string, any> = {};
  const addDetails = (src: Record<string, any>) => {
    details = _.assign(details, src);
  };

  const taintRequests = TrackingIdEquivalence.getAllKeys(taintFlows);
  const syntacticRequests = TrackingIdEquivalence.getAllKeys(syntacticFlows);
  addDetails({
    taintRequests,
    syntacticRequests,
  });

  const intersectRequests = _.intersection(taintRequests, syntacticRequests);
  const onlyTaintRequests = _.difference(taintRequests, syntacticRequests);
  const onlySyntacticRequests = _.difference(syntacticRequests, taintRequests);
  addDetails({
    intersectRequests,
    onlyTaintRequests: viewTaintTrackingRequests(onlyTaintRequests, taintFlows),
    onlySyntacticRequests: viewSyntacticTrackingRequests(
      onlySyntacticRequests,
      syntacticFlows,
    ),
  });

  const verifyResult = doVerify?.();
  if (verifyResult) {
    const { confirmedRequests, refutedRequests, unknownRequests } =
      verifyResult;
    addDetails({
      confirmedSyntacticRequests: viewSyntacticTrackingRequests(
        confirmedRequests,
        verifyResult.confirmedFlows,
      ),
      refutedSyntacticRequests: viewSyntacticTrackingRequests(
        refutedRequests,
        verifyResult.refutedFlows,
      ),
      unknownSyntacticRequests: viewSyntacticTrackingRequests(
        unknownRequests,
        _.union(verifyResult.unknownFlows, verifyResult.refutedFlows),
      ),
    });
  }

  writeOutputFileSync(
    path.join(outputName, `${site}.json`),
    JSON.stringify({
      site,
      ...details,
    }),
  );

  const unionRequests = _.union(taintRequests, syntacticRequests);
  return {
    site,
    pageUrl,
    requests: unionRequests.map(
      (requestId): TrackingRequest => ({
        id: requestId,
        tracker: getSiteFromUrl(requestId),
        taint: taintRequests.includes(requestId),
        syntactic: syntacticRequests.includes(requestId),
        confirmedSyntactic:
          verifyResult?.confirmedRequests.includes(requestId) ?? false,
        refutedSyntactic:
          verifyResult?.refutedRequests.includes(requestId) ?? false,
      }),
    ),
  };
}
