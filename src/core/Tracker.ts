import _ from "lodash";
import { Flow } from "./Flow";
import { FlowEquivalence } from "./FlowEquivalence";
import { getSiteFromUrl } from "../util/site";
import { truncateTokenValues } from "./Token";

export type Tracker = {
  site: string;
};

export const TrackerEquivalence = new FlowEquivalence(toTracker);

export function toTracker(flow: Flow): Tracker {
  const { requestUrl } = flow;
  return {
    site: getSiteFromUrl(requestUrl),
  };
}

export function viewTrackers(trackers: Tracker[], flows: Flow[]) {
  return trackers.map((tracker) => {
    const groupFlows = TrackerEquivalence.filterFlowsByKey(tracker, flows);

    const storageIds = _.uniqWith(
      groupFlows.map(({ storageItem: { id } }) => id),
      _.isEqual
    ).map((storageId) => `${storageId.storageType}:${storageId.key}`);

    return {
      tracker: tracker.site,
      storageIds,
    };
  });
}
