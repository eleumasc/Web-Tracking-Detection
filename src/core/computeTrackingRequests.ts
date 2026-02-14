import _ from "lodash";
import assert from "assert";
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
    const canaryStorageItems = JSON.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.canaryStorageItemsFile,
        ),
      ).toString(),
    );
    verifyResult = verifySyntacticRequests(
      syntacticRequests,
      canaryStorageItems,
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
    const canaryStorageItems = computed.canaryStorageItems;
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
      JSON.stringify(canaryStorageItems),
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
    const {
      confirmedRequests,
      refutedRequests,
      unknownRequests,
      noMatchingRequestsRequests,
      manyMatchingRequestsRequests,
    } = verifyResult;
    addDetails({
      confirmedSyntacticRequests: toAbstractRequests(confirmedRequests),
      refutedSyntacticRequests: toAbstractRequests(refutedRequests),
      unknownSyntacticRequests: toAbstractRequests(unknownRequests),
      noMatchingRequestsRequests: toAbstractRequests(
        noMatchingRequestsRequests,
      ),
      manyMatchingRequestsRequests: toAbstractRequests(
        manyMatchingRequestsRequests,
      ),
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

    const tracker = getSiteFromUrl(url);

    const taint = includesThisRequest(taintRequests);
    const syntactic = includesThisRequest(syntacticRequests);

    const noMatchingRequestsSyntactic = includesThisRequest(
      verifyResult?.noMatchingRequestsRequests,
    );
    const manyMatchingRequestsSyntactic = includesThisRequest(
      verifyResult?.manyMatchingRequestsRequests,
    );
    const confirmedSyntactic = includesThisRequest(
      verifyResult?.confirmedRequests,
    );
    const refutedSyntactic = includesThisRequest(verifyResult?.refutedRequests);
    const unknownSyntactic = includesThisRequest(verifyResult?.unknownRequests);

    if (verifyResult) {
      // the following verif flags should be mutually exclusive
      const verifFlagsCount =
        Number(noMatchingRequestsSyntactic) +
        Number(confirmedSyntactic) +
        Number(refutedSyntactic) +
        Number(unknownSyntactic);
      assert(syntactic ? verifFlagsCount === 1 : verifFlagsCount === 0);
    }

    return {
      requestId,
      url,
      tracker,
      taint,
      syntactic,
      noMatchingRequestsSyntactic,
      manyMatchingRequestsSyntactic,
      confirmedSyntactic,
      refutedSyntactic,
      unknownSyntactic,
    };
  });
}
