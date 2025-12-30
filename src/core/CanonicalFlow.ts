import _ from "lodash";
import { Flow } from "./Flow";
import { FlowEquivalence } from "./FlowEquivalence";
import { getCanonicalUrl } from "./CanonicalURL";
import { StorageItem } from "./StorageItem";
import { truncateTokenValues } from "./Token";

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

export function viewCanonicalFlows(
  canonicalFlows: CanonicalFlow[],
  flows: Flow[]
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
        storageToken: truncateTokenValues(storageToken),
        requestToken: truncateTokenValues(requestToken),
      }));

    return {
      storageId: `${storageId.storageType}:${storageId.key}`,
      requestId,
      matches,
    };
  });
}
