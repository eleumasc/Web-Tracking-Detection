import _ from "lodash";
import { Flow, SyntacticFlow, TaintFlow } from "./Flow";
import { FlowEquivalence } from "./FlowEquivalence";
import { getCanonicalUrl } from "./CanonicalURL";
import { StorageItem } from "./StorageItem";
import { viewToken } from "./syntacticMatching/Token";

export type CanonicalFlow = {
  storageId: StorageItem["id"];
  requestId: string;
};

export const CanonicalFlowEquivalence = new FlowEquivalence(toCanonicalFlow);

export function toCanonicalFlow(flow: Flow): CanonicalFlow {
  const {
    storageItem: { id: storageId },
    requestUrl,
  } = flow;
  return {
    storageId,
    requestId: getCanonicalUrl(requestUrl),
  };
}

export function viewSyntacticCanonicalFlows(
  canonicalFlows: CanonicalFlow[],
  flows: SyntacticFlow[]
) {
  return canonicalFlows.map((canonicalFlow) => {
    const { storageId, requestId } = canonicalFlow;
    const groupFlows = CanonicalFlowEquivalence.filterFlowsByKey(
      canonicalFlow,
      flows
    );

    const matches = groupFlows
      .flatMap(({ matches }) => matches)
      .map(({ storageToken, requestToken }) => ({
        storageToken: viewToken(storageToken),
        requestToken: viewToken(requestToken),
      }));

    return {
      storageId: `${storageId.storageType}:${storageId.key}`,
      requestId,
      matches,
    };
  });
}

export function viewTaintCanonicalFlows(
  canonicalFlows: CanonicalFlow[],
  flows: TaintFlow[]
) {
  return canonicalFlows.map((canonicalFlow) => {
    const { storageId, requestId } = canonicalFlow;

    return {
      storageId: `${storageId.storageType}:${storageId.key}`,
      requestId,
    };
  });
}
