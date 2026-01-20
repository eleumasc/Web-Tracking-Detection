import _ from "lodash";
import assert from "assert";
import { getRequestItemsFromHar, RequestItem } from "../RequestItem";
import { HarReader } from "../../util/HarReader";
import { memoize } from "../../util/memoize";
import { parseRequestValueEdges } from "./edges";
import { RequestTemplate } from "./RequestTemplate";
import { StorageCanariesEntry } from "./computeCanaries";
import { SyntacticFlow } from "../Flow";
import { TransformTree, traverseTransformTree } from "./TransformTree";
import {
  TrackingRequestId,
  TrackingRequestIdEquivalence,
} from "../TrackingRequest";

export function verifySyntacticTrackingRequests(
  trkRequests: TrackingRequestId[],
  flows: SyntacticFlow[],
  storageCanariesEntries: StorageCanariesEntry[],
  verifHarReader: HarReader,
  auxVerifHarReader: HarReader,
) {
  const confirmedFlows: SyntacticFlow[] = [];
  const refutedFlows: SyntacticFlow[] = [];
  const unknownFlows: SyntacticFlow[] = [];

  const verifRequestItems = getRequestItemsFromHar(verifHarReader);
  const auxVerifRequestItems = getRequestItemsFromHar(auxVerifHarReader);
  const parseRequestValue = memoize((initialValue: string): string[] => {
    const requestValues: string[] = [];
    traverseTransformTree(
      new TransformTree(parseRequestValueEdges, initialValue),
      (token) => {
        requestValues.push(token.value);
        return true;
      },
    );
    return requestValues;
  });

  for (const flow of flows) {
    const {
      storageItem: { id: storageId },
    } = flow;

    const canaries = storageCanariesEntries.find((entry) =>
      _.isEqual(entry.storageItem.id, storageId),
    )?.canaries;
    assert(canaries);

    const requestTemplate = RequestTemplate.fromSyntacticFlow(flow);
    const matchingVerifRequestItems = getMatchingRequestItems(
      verifRequestItems,
      requestTemplate,
    );
    const matchingAuxVerifRequestItems = getMatchingRequestItems(
      auxVerifRequestItems,
      requestTemplate,
    );

    if (matchingVerifRequestItems.length === 0) {
      unknownFlows.push(flow);
    } else if (
      matchingVerifRequestItems.some(({ params }) =>
        params.some(({ value: initialRequestValue }) =>
          parseRequestValue(initialRequestValue).some((requestValue) =>
            canaries.some((canary) => requestValue.includes(canary.modified)),
          ),
        ),
      )
    ) {
      confirmedFlows.push(flow);
    } else if (
      matchingAuxVerifRequestItems.every(({ params }) =>
        params.some(({ value: initialRequestValue }) =>
          parseRequestValue(initialRequestValue).some((requestValue) =>
            canaries.some((canary) => requestValue.includes(canary.original)),
          ),
        ),
      )
    ) {
      refutedFlows.push(flow);
    } else {
      unknownFlows.push(flow);
    }
  }

  const confirmedRequests: TrackingRequestId[] = [];
  const refutedRequests: TrackingRequestId[] = [];
  const unknownRequests: TrackingRequestId[] = [];

  for (const trkRequest of trkRequests) {
    const matchingFlows = TrackingRequestIdEquivalence.filterValuesByKey(
      trkRequest,
      flows,
    );
    assert(matchingFlows.length > 0);
    if (
      matchingFlows.some((matchingFlow) =>
        confirmedFlows.includes(matchingFlow),
      )
    ) {
      confirmedRequests.push(trkRequest);
    } else if (
      matchingFlows.every((matchingFlow) => refutedFlows.includes(matchingFlow))
    ) {
      refutedRequests.push(trkRequest);
    } else {
      unknownRequests.push(trkRequest);
    }
  }

  return {
    confirmedFlows,
    refutedFlows,
    unknownFlows,
    confirmedRequests,
    refutedRequests,
    unknownRequests,
  };
}

function getMatchingRequestItems(
  requestItems: RequestItem[],
  requestTemplate: RequestTemplate,
): RequestItem[] {
  return requestItems
    .filter((requestItem) => requestTemplate.matchesUrl(requestItem.url))
    .map(
      ({ url, params }): RequestItem => ({
        url,
        params: params.filter((param) =>
          requestTemplate.includesHole(param.key),
        ),
      }),
    )
    .filter(({ params }) => params.length > 0);
}
