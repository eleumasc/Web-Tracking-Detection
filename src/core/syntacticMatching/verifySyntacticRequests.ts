import _ from "lodash";
import { CanaryStorageItem } from "./CanaryStorageItem";
import { computeSyntacticRequests, SyntacticRequest } from "./SyntacticRequest";
import { createTokenTransformChain } from "./Token";
import { Har } from "../../util/Har";
import { Request } from "../Request";
import { RequestTemplate } from "./RequestTemplate";
import { StorageItem } from "../StorageItem";

export function verifySyntacticRequests(
  syntacticRequests: SyntacticRequest[],
  canaryStorageItems: CanaryStorageItem[],
  verifHar: Har,
  auxVerifHar: Har,
) {
  const originalCanaries = computeCanaryVerifMatches(canaryStorageItems, true);
  const modifiedCanaries = computeCanaryVerifMatches(canaryStorageItems);

  const originalStorageItems = extractStorageItems(canaryStorageItems, true);
  const modifiedStorageItems = extractStorageItems(canaryStorageItems);
  const verifRequests = computeVerifRequests(modifiedStorageItems, verifHar);
  const auxVerifRequests = computeVerifRequests(
    originalStorageItems,
    auxVerifHar,
  );

  const confirmedRequests: SyntacticRequest[] = [];
  const refutedRequests: SyntacticRequest[] = [];
  const unknownRequests: SyntacticRequest[] = [];
  const noMatchingRequestsRequests: SyntacticRequest[] = [];

  for (const syntacticRequest of syntacticRequests) {
    const verifMatchingRequests = getMatchingRequests(
      syntacticRequest,
      verifRequests,
    );
    const auxVerifMatchingRequests = getMatchingRequests(
      syntacticRequest,
      auxVerifRequests,
    );

    if (verifMatchingRequests.length === 0) {
      noMatchingRequestsRequests.push(syntacticRequest);
    } else if (
      verifMatchingRequests.some(
        (verifRequest) =>
          !_.isEmpty(
            _.intersectionWith(
              verifRequest.verifMatches,
              modifiedCanaries,
              _.isEqual,
            ),
          ),
      )
    ) {
      confirmedRequests.push(syntacticRequest);
    } else if (
      auxVerifMatchingRequests.every(
        (auxVerifRequest) =>
          !_.isEmpty(
            _.intersectionWith(
              auxVerifRequest.verifMatches,
              originalCanaries,
              _.isEqual,
            ),
          ),
      )
    ) {
      refutedRequests.push(syntacticRequest);
    } else {
      unknownRequests.push(syntacticRequest);
    }
  }

  return {
    confirmedRequests,
    refutedRequests,
    unknownRequests,
    noMatchingRequestsRequests,
  };
}

function getMatchingRequests(
  syntacticRequest: SyntacticRequest,
  verifRequests: VerifRequest[],
): VerifRequest[] {
  const requestTemplate =
    RequestTemplate.fromSyntacticRequest(syntacticRequest);
  return verifRequests.filter((verifRequest) =>
    requestTemplate.matchesUrl(verifRequest.url),
  );
}

interface VerifRequest extends Request {
  verifMatches: VerifMatch[];
}

interface VerifMatch {
  storageId: StorageItem["id"];
  transformChain: any[];
  value: string;
}

function computeVerifRequests(
  storageItems: StorageItem[],
  verifHar: Har,
): VerifRequest[] {
  // it is necessary to include all syntactic requests, including those without
  // storage matches, in order to count matching requests properly
  const syntacticRequests = computeSyntacticRequests(
    storageItems,
    verifHar,
    true,
  );

  return syntacticRequests.map((syntacticRequest): VerifRequest => {
    const { url, requestId } = syntacticRequest;
    const verifMatches = computeVerifMatches(syntacticRequest);
    return { url, requestId, verifMatches };
  });
}

function computeVerifMatches(syntacticRequest: SyntacticRequest): VerifMatch[] {
  const { storageMatches } = syntacticRequest;
  return _.intersectionWith(
    storageMatches.flatMap(
      ({ storageItem: { id: storageId }, syntacticMatches }) =>
        syntacticMatches.map(
          ({ storageToken: token }): VerifMatch => ({
            storageId,
            transformChain: createTokenTransformChain(token),
            value: token.value,
          }),
        ),
    ),
  );
}

function computeCanaryVerifMatches(
  canaryStorageItems: CanaryStorageItem[],
  original?: boolean,
): VerifMatch[] {
  return canaryStorageItems.flatMap(
    ({ storageItem: { id: storageId }, canaries }) =>
      canaries.map(
        ({ transformChain, value, originalValue }): VerifMatch => ({
          storageId,
          transformChain,
          value: original ? originalValue : value,
        }),
      ),
  );
}

function extractStorageItems(
  canaryStorageItems: CanaryStorageItem[],
  original?: boolean,
): StorageItem[] {
  return canaryStorageItems.map(
    ({ storageItem, originalValue }): StorageItem =>
      original ? { ...storageItem, value: originalValue } : storageItem,
  );
}
