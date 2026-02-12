import _ from "lodash";
import currentTime from "../util/currentTime";
import path from "path";
import { readFileSync, writeFileSync } from "fs";
import { TrackingRequest } from "../core/TrackingRequest";
import { TrackingRequestsLogEntry } from "./cmdMeasure";

interface SiteTrackingRequestsEntry {
  site: string;
  trackingRequests: TrackingRequest[];
}

export default async function cmdReport(args: { measureOutDir: string }) {
  const { measureOutDir } = args;

  const trackingRequestsLogEntry = JSON.parse(
    readFileSync(path.join(measureOutDir, "trackingRequests.json"), "utf8"),
  ) as TrackingRequestsLogEntry;

  const { totalSites, successSites, entries } = trackingRequestsLogEntry;
  const reportRecord = {
    totalSites,
    successSites,
    ...getStats(entries),
  };
  writeFileSync(
    path.join(measureOutDir, `report-${currentTime()}.json`),
    JSON.stringify(reportRecord),
  );
  console.log(reportRecord);

  process.exit(0);
}

function getStats(entries: SiteTrackingRequestsEntry[]) {
  return {
    intersectRequests: countCategoryRequests(
      entries,
      (r) => r.taint && r.syntactic,
    ),
    onlyTaintRequests: countCategoryRequests(
      entries,
      (r) => r.taint && !r.syntactic,
    ),
    onlySyntacticRequests: countCategoryRequests(
      entries,
      (r) => !r.taint && r.syntactic,
    ),
    confirmedSyntacticRequests: countCategoryRequests(
      entries,
      (r) => r.confirmedSyntactic,
    ),
    refutedSyntacticRequests: countCategoryRequests(
      entries,
      (r) => r.refutedSyntactic,
    ),
    unknownSyntacticRequests: countCategoryRequests(
      entries,
      (r) => r.syntactic && !r.confirmedSyntactic && !r.refutedSyntactic,
    ),

    taint: getCategoryStats(entries, (r) => r.taint),
    syntactic: getCategoryStats(entries, (r) => r.syntactic),
    union: getCategoryStats(entries, (r) => r.taint || r.syntactic),
    intersect: getCategoryStats(entries, (r) => r.taint && r.syntactic),
    confirmedSyntactic: getCategoryStats(entries, (r) => r.confirmedSyntactic),
    confirmedUnion: getCategoryStats(
      entries,
      (r) => r.taint || r.confirmedSyntactic,
    ),
    __nonRefutedSyntactic: getCategoryStats(
      entries,
      (r) => r.syntactic && !r.refutedSyntactic,
    ),
    __nonRefutedUnion: getCategoryStats(
      entries,
      (r) => r.taint || (r.syntactic && !r.refutedSyntactic),
    ),

    onlyTaintTrackers: getExclusiveCategoryTrackers(
      entries,
      (r) => r.taint && !r.syntactic,
    ),
    onlySyntacticTrackers: getExclusiveCategoryTrackers(
      entries,
      (r) => !r.taint && r.syntactic,
    ),
    fakeTrackers: getExclusiveCategoryTrackers(
      entries,
      (r) => r.refutedSyntactic,
    ),

    trackerPopularityRanking: _.sortBy(
      _.entries(_.countBy(entries.flatMap((entry) => getSiteTrackers(entry)))),
      ([_, popularity]) => popularity,
    ).reverse(),
  };
}

function getSiteTrackers(entry: SiteTrackingRequestsEntry): string[] {
  const { trackingRequests: requests } = entry;
  return _.uniq(requests.map((request) => request.tracker));
}

function countCategoryRequests(
  inputEntries: SiteTrackingRequestsEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  return _.sumBy(
    inputEntries,
    ({ trackingRequests: requests }) =>
      requests.filter((request) => property(request)).length,
  );
}

function getCategoryStats(
  inputEntries: SiteTrackingRequestsEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  const entries = inputEntries.map((entry): SiteTrackingRequestsEntry => {
    const { trackingRequests: requests } = entry;
    return {
      ...entry,
      trackingRequests: requests.filter((request) => property(request)),
    };
  });
  return {
    totalRequests: _.sumBy(
      entries,
      ({ trackingRequests: requests }) => requests.length,
    ),
    avgRequestsPerSite: _.meanBy(
      entries,
      ({ trackingRequests: requests }) => requests.length,
    ),
    maxRequestsPerSite: _.max(
      entries.map(({ trackingRequests: requests }) => requests.length),
    ),
    sitesHavingTrackers: _.sumBy(entries, ({ trackingRequests: requests }) =>
      Number(requests.length > 0),
    ),
    totalTrackers: _.uniq(entries.flatMap((entry) => getSiteTrackers(entry)))
      .length,
    avgTrackersPerSite: _.meanBy(
      entries,
      (entry) => getSiteTrackers(entry).length,
    ),
    maxTrackersPerSite: _.max(
      entries.map((entry) => getSiteTrackers(entry).length),
    ),
  };
}

function getExclusiveCategoryTrackers(
  inputEntries: SiteTrackingRequestsEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  // trackers belonging to an exclusive category...
  // INTERSECTION: for *all* sites including them (more strict)
  // UNION: for *any* sites including them (less strict)
  return _.intersection(
    ...inputEntries.map((entry) =>
      _.difference(
        getSiteTrackers(entry),
        entry.trackingRequests
          .filter((request) => !property(request))
          .map(({ tracker }) => tracker),
      ),
    ),
  );
}
