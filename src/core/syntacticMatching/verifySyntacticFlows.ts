import _ from "lodash";
import assert from "assert";
import { Flow, SyntacticFlow } from "../Flow";
import { HarReader } from "../../util/HarReader";
import { memoize } from "../../util/memoize";
import { parseRequestValueEdges } from "./edges";
import { StorageCanariesEntry } from "./computeCanaries";
import { TransformTree, traverseTransformTree } from "./TransformTree";
import { URLTemplate } from "./URLTemplate";
import {
  getRequestItemsFromHar,
  RequestItem,
  RequestParameter,
  RequestParameterKey,
} from "../RequestItem";

export type VerifySyntacticFlowsResult = {
  trueFlows: Flow[];
  fakeFlows: Flow[];
  unknownFlows: Flow[];
};

export function verifySyntacticFlows(
  flows: SyntacticFlow[],
  storageCanariesEntries: StorageCanariesEntry[],
  verifHarReader: HarReader
) {
  const trueFlows: SyntacticFlow[] = [];
  const fakeFlows: SyntacticFlow[] = [];
  const unknownFlows: SyntacticFlow[] = [];

  const requestItems = getRequestItemsFromHar(verifHarReader);

  const transformRequestValue = memoize((initialValue: string): string[] => {
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
    const { canaries, originalCanaries } = storageCanariesEntries.find(
      (entry) => _.isEqual(entry.storageItem.id, storageId)
    )!;
    assert(canaries);

    const urlTemplate = URLTemplate.fromSyntacticFlow(flow);
    const fittingRequestItems = requestItems.filter(({ url: requestUrl }) =>
      urlTemplate.fits(requestUrl)
    );
    if (fittingRequestItems.length === 0) {
      unknownFlows.push(flow);
    } else {
      const urlPlaceholders = urlTemplate.getPlaceholders();
      if (
        fittingRequestItems.some((requestItem) => {
          const requestParams = getRequestParams(requestItem, urlPlaceholders);
          return requestParams.some(({ value: initialRequestValue }) =>
            transformRequestValue(initialRequestValue).some((requestValue) =>
              canaries.some((canary) => requestValue.includes(canary))
            )
          );
        })
      ) {
        trueFlows.push(flow);
      } else if (
        fittingRequestItems.every((requestItem) => {
          const requestParams = getRequestParams(requestItem, urlPlaceholders);
          return requestParams.some(({ value: initialRequestValue }) =>
            transformRequestValue(initialRequestValue).some((requestValue) =>
              originalCanaries.some((canary) => requestValue.includes(canary))
            )
          );
        })
      ) {
        fakeFlows.push(flow);
      } else {
        unknownFlows.push(flow);
      }
    }
  }

  return {
    trueFlows,
    fakeFlows,
    unknownFlows,
  };
}

function getRequestParams(
  requestItem: RequestItem,
  urlPlaceholders: RequestParameterKey[]
): RequestParameter[] {
  return requestItem.params.filter(
    ({ key }) =>
      key.type === "postData" ||
      urlPlaceholders.some((placeholder) => _.isEqual(placeholder, key))
  );
}
