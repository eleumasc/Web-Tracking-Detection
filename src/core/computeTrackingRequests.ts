import _ from "lodash";
import assert from "assert";
import path from "path";
import { computeUnverifiedTrackingRequests } from "./computeUnverifiedTrackingRequests";
import { FoxURL } from "../foxhound/FoxURL";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { Har } from "../util/Har";
import { readFileSync } from "fs";
import { Request, toAbstractRequests } from "./Request";
import { RequestParam } from "./RequestParam";
import { RequestTemplate } from "./syntacticMatching/RequestTemplate";
import { StatefulTrackingAnalysisResult } from "./AnalysisResult";
import { SyntacticRequest } from "./syntacticMatching/SyntacticRequest";
import { TaintRequest } from "./taintTracking/TaintRequest";
import { verifySyntacticRequests } from "./syntacticMatching/verifySyntacticRequests";
import { verifyTaintRequests } from "./taintTracking/verifyTaintRequests";
import {
  SyntacticVerifLabel,
  TaintVerifLabel,
  TrackingRequest,
} from "./TrackingRequest";

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
  let syntacticVerifResult = undefined;
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
    syntacticVerifResult = verifySyntacticRequests(
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

  const taintVerifResult = verifyTaintRequests(taintRequests);

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

  {
    const { confirmedRequests, unknownRequests } = taintVerifResult;
    addDetails({
      confirmedTaintRequests: toAbstractRequests(confirmedRequests),
      unknownTaintRequests: toAbstractRequests(unknownRequests),
    });
  }

  if (syntacticVerifResult) {
    const {
      confirmedRequests,
      refutedRequests,
      unknownRequests,
      noMatchingRequestsRequests,
    } = syntacticVerifResult;
    addDetails({
      confirmedSyntacticRequests: toAbstractRequests(confirmedRequests),
      refutedSyntacticRequests: toAbstractRequests(refutedRequests),
      unknownSyntacticRequests: toAbstractRequests(unknownRequests),
      noMatchingRequestsRequests: toAbstractRequests(
        noMatchingRequestsRequests,
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

    const tracker = new FoxURL(url).hostname;

    const taint = includesThisRequest(taintRequests);
    const syntactic = includesThisRequest(syntacticRequests);

    const confirmedTaint = includesThisRequest(
      taintVerifResult.confirmedRequests,
    );
    const unknownTaint = includesThisRequest(taintVerifResult.unknownRequests);
    if (true) {
      // the following verif flags should be mutually exclusive
      const verifFlagsCount = Number(confirmedTaint) + Number(unknownTaint);
      assert(taint ? verifFlagsCount === 1 : verifFlagsCount === 0);
    }
    let taintVerifLabel: TaintVerifLabel | undefined;
    if (confirmedTaint) {
      taintVerifLabel = "CONFIRMED";
    } else if (unknownTaint) {
      taintVerifLabel = "UNKNOWN";
    }

    const noMatchingRequestsSyntactic = includesThisRequest(
      syntacticVerifResult?.noMatchingRequestsRequests,
    );
    const confirmedSyntactic = includesThisRequest(
      syntacticVerifResult?.confirmedRequests,
    );
    const refutedSyntactic = includesThisRequest(
      syntacticVerifResult?.refutedRequests,
    );
    const unknownSyntactic = includesThisRequest(
      syntacticVerifResult?.unknownRequests,
    );
    if (syntacticVerifResult) {
      // the following verif flags should be mutually exclusive
      const verifFlagsCount =
        Number(noMatchingRequestsSyntactic) +
        Number(confirmedSyntactic) +
        Number(refutedSyntactic) +
        Number(unknownSyntactic);
      assert(syntactic ? verifFlagsCount === 1 : verifFlagsCount === 0);
    }
    let syntacticVerifLabel: SyntacticVerifLabel | undefined;
    if (confirmedSyntactic) {
      syntacticVerifLabel = "CONFIRMED";
    } else if (refutedSyntactic) {
      syntacticVerifLabel = "REFUTED";
    } else if (unknownSyntactic) {
      syntacticVerifLabel = "UNKNOWN";
    } else if (noMatchingRequestsSyntactic) {
      syntacticVerifLabel = "NO_MATCHING_REQUESTS";
    }

    let syntacticHoles: RequestParam[] | undefined;
    if (syntactic) {
      const syntacticRequest = syntacticRequests.find(
        (request) => request.requestId === requestId,
      );
      assert(syntacticRequest, JSON.stringify({ site, requestId }));
      syntacticHoles =
        RequestTemplate.fromSyntacticRequest(syntacticRequest).holes;
    }

    return {
      requestId,
      url,
      tracker,
      taint,
      syntactic,
      taintVerifLabel,
      syntacticVerifLabel,
      syntacticHoles,
    };
  });
}
