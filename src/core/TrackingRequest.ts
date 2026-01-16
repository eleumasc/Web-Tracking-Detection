import _ from "lodash";
import { Equivalence } from "../util/Equivalence";
import { Flow, SyntacticFlow } from "./Flow";
import { viewToken } from "./syntacticMatching/Token";

export type TrackingRequest = {
  id: string;
};

export const TrackingRequestEquivalence = new Equivalence(
  (flow: Flow): TrackingRequest => {
    const { requestUrl } = flow;
    return {
      id: getTrackingRequestId(requestUrl),
    };
  }
);

export function getTrackingRequestId(url: string): string {
  const { origin, pathname, searchParams } = new URL(url);
  const pathSegments = pathname.split("/").slice(1);
  const paramNames = [...searchParams.entries()]
    .flatMap(([key, value]) => (value ? [key] : []))
    .sort();
  return origin + "/" + pathSegments.join("/") + "?" + paramNames.join("&");
}

export function viewSyntacticTrackingRequests(
  requests: TrackingRequest[],
  flows: SyntacticFlow[]
) {
  return requests.map((trkRequest) => {
    const { id } = trkRequest;

    return {
      id,
      flows: groupFlowsByStorageId(
        TrackingRequestEquivalence.filterValuesByKey(trkRequest, flows)
      ).map(([storageId, groupFlows]) => ({
        storageId,
        matches: _.uniqWith(
          groupFlows.flatMap(({ matches }) => matches),
          _.isEqual
        ).map(({ storageToken, requestToken }) => ({
          storageToken: viewToken(storageToken),
          requestToken: viewToken(requestToken),
        })),
      })),
    };
  });
}

export function viewTaintTrackingRequests(
  trkRequests: TrackingRequest[],
  flows: Flow[]
) {
  return trkRequests.map((trkRequest) => {
    const { id } = trkRequest;

    return {
      id,
      flows: groupFlowsByStorageId(
        TrackingRequestEquivalence.filterValuesByKey(trkRequest, flows)
      ).map(([storageId, groupFlows]) => ({
        storageId,
        matches: _.uniqWith(
          groupFlows.map(({ storageItem, requestUrl, ...rest }) => rest),
          _.isEqual
        ),
      })),
    };
  });
}

function groupFlowsByStorageId<T extends Flow>(flows: T[]) {
  const storageItems = _.uniqWith(
    flows.map((flow) => flow.storageItem),
    _.isEqual
  );

  return storageItems.map((storageItem): [string, T[]] => {
    const { id: storageId } = storageItem;
    return [
      `${storageId.storageType}:${storageId.key}`,
      flows.filter((flow) => _.isEqual(flow.storageItem, storageItem)),
    ];
  });
}
