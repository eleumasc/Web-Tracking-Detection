import _ from "lodash";
import path from "path";
import { computeUnverifiedTrackingRequests } from "./computeUnverifiedTrackingRequests";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getSiteFromUrl } from "../util/site";
import { Har } from "../util/Har";
import { readFileSync } from "fs";
import { Request, toAbstractRequests } from "./Request";
import { StatefulTrackingAnalysisResult } from "./AnalysisResult";
import { SyntacticRequest } from "./syntacticMatching/SyntacticRequest";
import { TaintRequest } from "./taintTracking/TaintRequest";
import { TrackingRequest } from "./TrackingRequest";
import { verifySyntacticRequests } from "./syntacticMatching/verifySyntacticRequests";

export function computeTrackingRequests(args: {
  site: string;
  analysisName: string;
  outputName: string;
  staResult: StatefulTrackingAnalysisResult;
  forceNoVerif?: boolean;
}): TrackingRequest[] {
  const { site, analysisName, outputName, staResult, forceNoVerif } = args;

  let taintRequests: TaintRequest[];
  let syntacticRequests: SyntacticRequest[];
  let verifyResult = undefined;
  if (staResult.verif && !forceNoVerif) {
    taintRequests = JSON.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.taintRequestsFile,
        ),
      ).toString(),
    );
    syntacticRequests = JSON.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.syntacticRequestsFile,
        ),
      ).toString(),
    );
    const modifiedStorageItems = JSON.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.modifiedStorageItemsFile,
        ),
      ).toString(),
    );
    verifyResult = verifySyntacticRequests(
      syntacticRequests,
      modifiedStorageItems,
      new Har(path.join(getOutputPath(analysisName), staResult.verif!.harFile)),
      new Har(
        path.join(getOutputPath(analysisName), staResult.auxVerif!.harFile),
      ),
    );
  } else {
    const computed = computeUnverifiedTrackingRequests({
      analysisName,
      staResult,
    });
    taintRequests = computed.taintRequests;
    syntacticRequests = computed.syntacticRequests;
    const modifiedStorageItems = computed.modifiedStorageItems;
    writeOutputFileSync(
      path.join(outputName, `${site}+T.json`),
      JSON.stringify(taintRequests),
    );
    writeOutputFileSync(
      path.join(outputName, `${site}+S.json`),
      JSON.stringify(syntacticRequests),
    );
    writeOutputFileSync(
      path.join(outputName, `${site}+C.json`),
      JSON.stringify(modifiedStorageItems),
    );
  }

  let detailRecord: Record<string, any> = {};
  const addDetails = (src: Record<string, any>) => {
    detailRecord = _.assign(detailRecord, src);
  };

  const absTaintRequests = toAbstractRequests(taintRequests);
  const absSyntacticRequests = toAbstractRequests(syntacticRequests);

  const intersectRequests = _.intersectionWith(
    absTaintRequests,
    absSyntacticRequests,
    _.isEqual,
  );
  const onlyTaintRequests = _.differenceWith(
    absTaintRequests,
    absSyntacticRequests,
    _.isEqual,
  );
  const onlySyntacticRequests = _.differenceWith(
    absSyntacticRequests,
    absTaintRequests,
    _.isEqual,
  );
  addDetails({
    intersectRequests,
    onlyTaintRequests,
    onlySyntacticRequests,
  });

  if (verifyResult) {
    const { confirmedRequests, refutedRequests, unknownRequests } =
      verifyResult;
    addDetails({
      confirmedSyntacticRequests: toAbstractRequests(confirmedRequests),
      refutedSyntacticRequests: toAbstractRequests(refutedRequests),
      unknownSyntacticRequests: toAbstractRequests(unknownRequests),
    });
  }

  writeOutputFileSync(
    path.join(outputName, `${site}.json`),
    JSON.stringify(detailRecord),
  );

  const unionRequests = _.unionWith(
    absTaintRequests,
    absSyntacticRequests,
    _.isEqual,
  );
  return unionRequests.map(({ requestId, url }): TrackingRequest => {
    const includesThisRequest = <T extends Request>(
      requests: T[] | undefined,
    ): boolean =>
      requests?.some((request) => request.requestId === requestId) ?? false;

    return {
      requestId,
      url,
      tracker: getSiteFromUrl(url),
      taint: includesThisRequest(taintRequests),
      syntactic: includesThisRequest(syntacticRequests),
      confirmedSyntactic: includesThisRequest(verifyResult?.confirmedRequests),
      refutedSyntactic: includesThisRequest(verifyResult?.refutedRequests),
    };
  });
}
