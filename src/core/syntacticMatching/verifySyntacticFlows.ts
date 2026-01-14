import _ from "lodash";
import assert from "assert";
import { Flow, SyntacticFlow } from "../Flow";
import { getRequestItemsFromHar, RequestItem } from "../RequestItem";
import { HarReader } from "../../util/HarReader";
import { memoize } from "../../util/memoize";
import { parseRequestValueEdges } from "./edges";
import { RequestTemplate } from "./RequestTemplate";
import { StorageCanariesEntry } from "./computeCanaries";
import { TransformTree, traverseTransformTree } from "./TransformTree";

export type VerifySyntacticFlowsResult = {
  trueFlows: Flow[];
  fakeFlows: Flow[];
  unknownFlows: Flow[];
};

export function verifySyntacticFlows(
  flows: SyntacticFlow[],
  storageCanariesEntries: StorageCanariesEntry[],
  verifHarReader: HarReader,
  auxVerifHarReader: HarReader
) {
  const trueFlows: SyntacticFlow[] = [];
  const fakeFlows: SyntacticFlow[] = [];
  const unknownFlows: SyntacticFlow[] = [];

  const zeroMatchingRequestsFlows: SyntacticFlow[] = [];
  const oneMatchingRequestFlows: SyntacticFlow[] = [];

  const verifRequestItems = getRequestItemsFromHar(verifHarReader);
  const auxVerifRequestItems = getRequestItemsFromHar(auxVerifHarReader);
  const parseRequestValue = memoize((initialValue: string): string[] => {
    const requestValues: string[] = [];
    traverseTransformTree(
      new TransformTree(parseRequestValueEdges, initialValue),
      (token) => {
        requestValues.push(token.value);
        return true;
      }
    );
    return requestValues;
  });

  for (const flow of flows) {
    const {
      storageItem: { id: storageId },
    } = flow;

    const canaries = storageCanariesEntries.find((entry) =>
      _.isEqual(entry.storageItem.id, storageId)
    )?.canaries;
    assert(canaries);

    const requestTemplate = RequestTemplate.fromSyntacticFlow(flow);

    const matchingVerifRequestItems = getMatchingRequestItems(
      verifRequestItems,
      requestTemplate
    );
    const matchingAuxVerifRequestItems = getMatchingRequestItems(
      auxVerifRequestItems,
      requestTemplate
    );
    if (matchingVerifRequestItems.length === 0) {
      unknownFlows.push(flow);
    } else if (
      matchingVerifRequestItems.some(({ params }) =>
        params.some(({ value: initialRequestValue }) =>
          parseRequestValue(initialRequestValue).some((requestValue) =>
            canaries.some((canary) => requestValue.includes(canary.modified))
          )
        )
      )
    ) {
      trueFlows.push(flow);
    } else if (
      matchingAuxVerifRequestItems.every(({ params }) =>
        params.some(({ value: initialRequestValue }) =>
          parseRequestValue(initialRequestValue).some((requestValue) =>
            canaries.some((canary) => requestValue.includes(canary.original))
          )
        )
      )
    ) {
      fakeFlows.push(flow);
    } else {
      unknownFlows.push(flow);
    }

    if (matchingVerifRequestItems.length === 0) {
      zeroMatchingRequestsFlows.push(flow);
    } else if (matchingVerifRequestItems.length === 1) {
      oneMatchingRequestFlows.push(flow);
    }
  }

  return {
    trueFlows,
    fakeFlows,
    unknownFlows,
    zeroMatchingRequestsFlows,
    oneMatchingRequestFlows,
  };
}

function getMatchingRequestItems(
  requestItems: RequestItem[],
  requestTemplate: RequestTemplate
): RequestItem[] {
  return requestItems
    .filter((requestItem) => requestTemplate.matchesUrl(requestItem.url))
    .map(
      ({ url, params }): RequestItem => ({
        url,
        params: params.filter((param) =>
          requestTemplate.includesHole(param.key)
        ),
      })
    )
    .filter(({ params }) => params.length > 0);
}
