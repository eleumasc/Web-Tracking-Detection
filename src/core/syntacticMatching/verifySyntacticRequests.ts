import _ from "lodash";
import { computeSyntacticRequests, SyntacticRequest } from "./SyntacticRequest";
import { Har } from "../../util/Har";
import { map, toArray } from "iter-tools";
import { ModifiedStorageItem } from "./createModifiedStorageItems";
import { RequestParam } from "./RequestParam";
import { RequestTemplate } from "./RequestTemplate";
import { StorageItem } from "../StorageItem";
import { Token, tokenChain } from "./Token";
import { weakMemoize } from "../../util/memoize";

interface AbstractMatch {
  storageId: StorageItem["id"];
  requestParam: RequestParam;
  transformChain: any[];
}

export function verifySyntacticRequests(
  requests: SyntacticRequest[],
  modifiedStorageItems: ModifiedStorageItem[],
  verifHar: Har,
  auxVerifHar: Har,
) {
  const modifiedIdentifiers = modifiedStorageItems.map(
    ({ storageItem }) => storageItem,
  );
  const verifRequests = computeSyntacticRequests(modifiedIdentifiers, verifHar);
  const originalIdentifiers = modifiedStorageItems.map(
    ({ storageItem, originalValue }) => ({
      ...storageItem,
      value: originalValue,
    }),
  );
  const auxVerifRequests = computeSyntacticRequests(
    originalIdentifiers,
    auxVerifHar,
  );

  const getAbstractMatches = weakMemoize((request: SyntacticRequest) =>
    request.storageMatches.flatMap(
      ({ storageItem: { id: storageId }, syntacticMatches }) =>
        syntacticMatches.map(
          ({ storageToken, requestParam }): AbstractMatch => ({
            storageId,
            requestParam: requestParam,
            transformChain: toArray(
              map(
                //
                (x: Token) => x.transform && { ...x.transform },
              )(tokenChain(storageToken)),
            ),
          }),
        ),
    ),
  );

  const confirmedRequests: SyntacticRequest[] = [];
  const refutedRequests: SyntacticRequest[] = [];
  const unknownRequests: SyntacticRequest[] = [];
  const noMatchingRequestsRequests: SyntacticRequest[] = [];
  const manyMatchingRequestsRequests: SyntacticRequest[] = [];

  for (const request of requests) {
    const matchingVerifRequests = getMatchingRequests(request, verifRequests);
    const matchingAuxVerifRequests = getMatchingRequests(
      request,
      auxVerifRequests,
    );

    if (matchingVerifRequests.length === 0) {
      noMatchingRequestsRequests.push(request);
    } else if (
      matchingVerifRequests.some(
        (verifRequest) =>
          !_.isEmpty(
            _.intersectionWith(
              getAbstractMatches(verifRequest),
              getAbstractMatches(request),
              _.isEqual,
            ),
          ),
      )
    ) {
      confirmedRequests.push(request);
    } else if (
      matchingAuxVerifRequests.every(
        (auxVerifRequest) =>
          !_.isEmpty(
            _.intersectionWith(
              getAbstractMatches(auxVerifRequest),
              getAbstractMatches(request),
              _.isEqual,
            ),
          ),
      )
    ) {
      refutedRequests.push(request);
    } else {
      unknownRequests.push(request);
    }

    if (matchingVerifRequests.length > 1) {
      manyMatchingRequestsRequests.push(request);
    }
  }

  return {
    confirmedRequests,
    refutedRequests,
    unknownRequests,
    noMatchingRequestsRequests,
    manyMatchingRequestsRequests,
  };
}

function getMatchingRequests(
  request: SyntacticRequest,
  verifRequests: SyntacticRequest[],
): SyntacticRequest[] {
  const requestTemplate = RequestTemplate.fromSyntacticRequest(request);
  return verifRequests.filter((verifRequest) => {
    const { url: verifUrl } = verifRequest;
    return requestTemplate.matchesUrl(verifUrl);
  });
}
