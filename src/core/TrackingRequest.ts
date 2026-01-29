import _ from "lodash";
import { Equivalence } from "../util/Equivalence";
import { Flow, SyntacticFlow } from "./Flow";
import { viewToken } from "./syntacticMatching/Token";

export interface TrackingRequest {
  id: TrackingId;
  tracker: string;
  taint: boolean;
  syntactic: boolean;
  confirmedSyntactic: boolean;
  refutedSyntactic: boolean;
}

export type TrackingId = string;

export const TrackingIdEquivalence = new Equivalence(
  (flow: Flow): TrackingId => {
    const { requestUrl } = flow;
    return getTrackingId(requestUrl);
  },
);

export function getTrackingId(url: string): string {
  const { origin, pathname, searchParams } = new URL(url);
  const pathSegments = pathname.split("/").slice(1);
  const paramNames = [...searchParams.entries()]
    .flatMap(([key, value]) => (value ? [key] : []))
    .sort();
  return origin + "/" + pathSegments.join("/") + "?" + paramNames.join("&");
}

export function viewSyntacticTrackingRequests(
  trkIds: TrackingId[],
  flows: SyntacticFlow[],
) {
  return trkIds.map((id) => {
    return {
      id,
      flows: groupFlowsByStorageId(
        TrackingIdEquivalence.filterValuesByKey(id, flows),
      ).map(([storageId, groupFlows]) => ({
        storageId,
        matches: _.uniqWith(
          groupFlows.flatMap(({ matches }) => matches),
          _.isEqual,
        ).map(({ storageToken, requestToken }) => ({
          storageToken: viewToken(storageToken),
          requestToken: viewToken(requestToken),
        })),
      })),
    };
  });
}

export function viewTaintTrackingRequests(
  trkIds: TrackingId[],
  flows: Flow[],
) {
  return trkIds.map((id) => {
    return {
      id,
      flows: groupFlowsByStorageId(
        TrackingIdEquivalence.filterValuesByKey(id, flows),
      ).map(([storageId, groupFlows]) => ({
        storageId,
        matches: _.uniqWith(
          groupFlows.map(({ storageItem, requestUrl, ...rest }) => rest),
          _.isEqual,
        ),
      })),
    };
  });
}

function groupFlowsByStorageId<T extends Flow>(flows: T[]) {
  const storageItems = _.uniqWith(
    flows.map((flow) => flow.storageItem),
    _.isEqual,
  );

  return storageItems.map((storageItem): [string, T[]] => {
    const { id: storageId } = storageItem;
    return [
      `${storageId.storageType}:${storageId.key}`,
      flows.filter((flow) => _.isEqual(flow.storageItem, storageItem)),
    ];
  });
}
