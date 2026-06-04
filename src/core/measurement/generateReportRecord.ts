import _ from "lodash";
import { checkInDisconnect } from "../../util/Disconnect";
import { FoxURL } from "../../foxhound/FoxURL";
import { TrackingRequestsFile } from "../../commands/cmdProcess";
import {
  siteTrackers,
  TrackingRequest,
  TrackingSiteEntry,
} from "../TrackingRequest";

export type ReportRecord = ReturnType<typeof generateReportRecord>;

export function generateReportRecord(
  trackingRequestsFile: TrackingRequestsFile
) {
  const { totalSites, successSites, entries } = trackingRequestsFile;

  return {
    totalSites,
    successSites,

    taintRequests: countCategoryRequests(entries, (r) => r.taint),
    syntacticRequests: countCategoryRequests(entries, (r) => r.syntactic),

    unionRequests: countCategoryRequests(
      entries,
      (r) => r.taint || r.syntactic
    ),
    intersectRequests: countCategoryRequests(
      entries,
      (r) => r.taint && r.syntactic
    ),
    onlyTaintRequests: countCategoryRequests(
      entries,
      (r) => r.taint && !r.syntactic
    ),
    onlySyntacticRequests: countCategoryRequests(
      entries,
      (r) => !r.taint && r.syntactic
    ),

    onlyTaintVerif: getTaintVerifStats(entries, (r) => r.taint && !r.syntactic),

    syntacticVerif: getSyntacticVerifStats(entries, (r) => r.syntactic),
    intersectVerif: getSyntacticVerifStats(
      entries,
      (r) => r.taint && r.syntactic
    ),
    onlySyntacticVerif: getSyntacticVerifStats(
      entries,
      (r) => !r.taint && r.syntactic
    ),

    statsTaint: getShortCategoryStats(entries, (r) => r.taint),
    statsSyntactic: getShortCategoryStats(entries, (r) => r.syntactic),
    statsConfirmedSyntactic: getShortCategoryStats(
      entries,
      (r) => r.syntacticVerifLabel === "CONFIRMED"
    ),
    statsNonRefutedSyntactic: getShortCategoryStats(
      entries,
      (r) => r.syntactic && r.syntacticVerifLabel !== "REFUTED"
    ),
    statsConfirmedSyntacticUnion: getShortCategoryStats(
      entries,
      (r) => r.taint || r.syntacticVerifLabel === "CONFIRMED"
    ),
    statsTaintAfterDisconnect: getShortCategoryStats(
      entries,
      (r) => r.taint && !checkInDisconnect(r.tracker)
    ),
    statsConfirmedSyntacticAfterDisconnect: getShortCategoryStats(
      entries,
      (r) =>
        r.syntacticVerifLabel === "CONFIRMED" && !checkInDisconnect(r.tracker)
    ),

    compareTaintVsSyntactic: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.syntactic
    ),
    compareTaintVsConfirmedSyntactic: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.syntacticVerifLabel === "CONFIRMED"
    ),
    compareTaintVsNonRefutedSyntactic: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.syntactic && r.syntacticVerifLabel !== "REFUTED"
    ),

    compareSyntacticVsConfirmedSyntactic: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.syntacticVerifLabel === "CONFIRMED"
    ),
    compareSyntacticVsNonRefutedSyntactic: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.syntactic && r.syntacticVerifLabel !== "REFUTED"
    ),
    compareSyntacticVsUnion: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.taint || r.syntactic
    ),

    compareUnionVsIntersect: compareCategories(
      entries,
      (r) => r.taint || r.syntactic,
      (r) => r.taint && r.syntactic
    ),
    compareConfirmedSyntacticUnionVsIntersect: compareCategories(
      entries,
      (r) => r.taint || r.syntacticVerifLabel === "CONFIRMED",
      (r) => r.taint && r.syntacticVerifLabel === "CONFIRMED"
    ),

    compareTaintPreVsAfterDisconnect: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.taint && !checkInDisconnect(r.tracker)
    ),
    compareSyntacticPreVsAfterDisconnect: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.syntactic && !checkInDisconnect(r.tracker)
    ),
    compareConfirmedSyntacticPreVsAfterDisconnect: compareCategories(
      entries,
      (r) => r.syntacticVerifLabel === "CONFIRMED",
      (r) =>
        r.syntacticVerifLabel === "CONFIRMED" && !checkInDisconnect(r.tracker)
    ),
    compareTaintAfterDisconnectVsSyntacticAfterDisconnect: compareCategories(
      entries,
      (r) => r.taint && !checkInDisconnect(r.tracker),
      (r) => r.syntactic && !checkInDisconnect(r.tracker)
    ),
    compareTaintAfterDisconnectVsConfirmedSyntacticAfterDisconnect:
      compareCategories(
        entries,
        (r) => r.taint && !checkInDisconnect(r.tracker),
        (r) =>
          r.syntacticVerifLabel === "CONFIRMED" && !checkInDisconnect(r.tracker)
      ),

    manValidRefutedSyntactic: sampleRequestsForManualValidation(
      entries,
      (r) => r.syntacticVerifLabel === "REFUTED"
    ),
    manValidConfirmedOnlyTaint: sampleRequestsForManualValidation(
      entries,
      (r) => r.taintVerifLabel === "CONFIRMED" && !r.syntactic
    ),
    manValidUnknownOnlyTaint: sampleRequestsForManualValidation(
      entries,
      (r) => r.taintVerifLabel === "UNKNOWN" && !r.syntactic
    ),
    manValidConfirmedOnlySyntactic: sampleRequestsForManualValidation(
      entries,
      (r) => !r.taint && r.syntacticVerifLabel === "CONFIRMED"
    ),
  };
}

function applyProperty(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean
): TrackingSiteEntry[] {
  // do not remove entries which have no tracking requests:
  // those are required for computing avg correctly
  return inputEntries.map(
    (entry): TrackingSiteEntry => ({
      ...entry,
      trackingRequests: entry.trackingRequests //
        .filter((request) => property(request)),
    })
  );
}

function countCategoryRequests(
  inputEntries: TrackingSiteEntry[],
  property?: (request: TrackingRequest) => boolean
): number {
  return _.sumBy(inputEntries, ({ trackingRequests: requests }) =>
    property
      ? requests.filter((request) => property(request)).length
      : requests.length
  );
}

function percent(count: number, total: number): string {
  return `${Math.round((count / total) * 100)}%`;
}

function getTaintVerifStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean
) {
  const entries = applyProperty(inputEntries, property);
  const total = countCategoryRequests(entries);
  const countPercent = (
    countProperty: (request: TrackingRequest) => boolean
  ) => {
    const count = countCategoryRequests(entries, countProperty);
    return [count, percent(count, total)];
  };
  return {
    confirmedRequests: countPercent((r) => r.taintVerifLabel === "CONFIRMED"),
    unknownRequests: countPercent((r) => r.taintVerifLabel === "UNKNOWN"),
  };
}

function getSyntacticVerifStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean
) {
  const entries = applyProperty(inputEntries, property);
  const total = countCategoryRequests(
    entries,
    (r) =>
      r.syntacticVerifLabel === "CONFIRMED" ||
      r.syntacticVerifLabel === "REFUTED" ||
      r.syntacticVerifLabel === "UNKNOWN"
  );
  const countPercent = (
    countProperty: (request: TrackingRequest) => boolean
  ) => {
    const count = countCategoryRequests(entries, countProperty);
    return [count, percent(count, total)];
  };
  return {
    noMatchingRequestsRequests: countCategoryRequests(
      entries,
      (r) => r.syntacticVerifLabel === "NO_MATCHING_REQUESTS"
    ),
    confirmedRequests: countPercent(
      (r) => r.syntacticVerifLabel === "CONFIRMED"
    ),
    refutedRequests: countPercent((r) => r.syntacticVerifLabel === "REFUTED"),
    unknownRequests: countPercent((r) => r.syntacticVerifLabel === "UNKNOWN"),
  };
}

interface TrackerRanking {
  tracker: string;
  rank: number;
  popularity: number;
  inDisconnect: boolean;
}

function getTrackerRankings(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean
): TrackerRanking[] {
  const entries = applyProperty(inputEntries, property);
  return _.sortBy(
    _.entries(_.countBy(entries.flatMap((entry) => siteTrackers(entry)))),
    ([_, popularity]) => popularity
  )
    .reverse()
    .map(([tracker, popularity], index) => ({
      tracker,
      rank: index + 1,
      popularity,
      inDisconnect: checkInDisconnect(tracker),
    }));
}

function topTrackerRankings(
  trackerRankings: TrackerRanking[]
): TrackerRanking[] {
  return trackerRankings.slice(0, 10);
}

function getCategoryStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean
) {
  const entries = applyProperty(inputEntries, property);
  const entriesInDisconnect = applyProperty(entries, (r) =>
    checkInDisconnect(r.tracker)
  );

  const totalRequests = (entries: TrackingSiteEntry[]): number =>
    _.sumBy(entries, ({ trackingRequests }) => trackingRequests.length);

  const avgRequestsPerSite = (entries: TrackingSiteEntry[]): number =>
    _.meanBy(entries, ({ trackingRequests }) => trackingRequests.length);

  const totalTrackers = (entries: TrackingSiteEntry[]): number =>
    _.uniq(entries.flatMap((entry) => siteTrackers(entry))).length;

  const avgTrackersPerSite = (entries: TrackingSiteEntry[]): number =>
    _.meanBy(entries, (entry) => siteTrackers(entry).length);

  const sitesHavingTrackers = (entries: TrackingSiteEntry[]): number =>
    _.sumBy(entries, ({ trackingRequests }) =>
      Number(trackingRequests.length > 0)
    );

  return {
    totalRequests: totalRequests(entries),
    totalRequestsInDisconnect: totalRequests(entriesInDisconnect),

    avgRequestsPerSite: avgRequestsPerSite(entries),
    avgRequestsPerSiteInDisconnect: avgRequestsPerSite(entriesInDisconnect),

    totalTrackers: totalTrackers(entries),
    totalTrackersInDisconnect: totalTrackers(entriesInDisconnect),

    avgTrackersPerSite: avgTrackersPerSite(entries),
    avgTrackersPerSiteInDisconnect: avgTrackersPerSite(entriesInDisconnect),

    sitesHavingTrackers: sitesHavingTrackers(entries),
    sitesHavingTrackersInDisconnect: sitesHavingTrackers(entriesInDisconnect),

    requests: entries.flatMap((x) => x.trackingRequests),
    trackerRankings: getTrackerRankings(inputEntries, property),
  };
}

function getShortCategoryStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean
) {
  const categoryStats = getCategoryStats(inputEntries, property);

  const result0 = _.pick(categoryStats, [
    "totalRequests",
    "totalRequestsInDisconnect",
    "avgRequestsPerSite",
    "avgRequestsPerSiteInDisconnect",
    "totalTrackers",
    "totalTrackersInDisconnect",
    "avgTrackersPerSite",
    "avgTrackersPerSiteInDisconnect",
    "sitesHavingTrackers",
    "sitesHavingTrackersInDisconnect",
  ]);

  const { requests, trackerRankings } = categoryStats;
  const result1 = {
    ...result0,
    requestCountByTracker: _.countBy(requests, (x) => x.tracker),
    trackerRankings: topTrackerRankings(trackerRankings),
  };

  return result1;
}

function compareCategories(
  inputEntries: TrackingSiteEntry[],
  aProperty: (request: TrackingRequest) => boolean,
  bProperty: (request: TrackingRequest) => boolean
) {
  const result0 = {};

  const a = getCategoryStats(inputEntries, aProperty);
  const result1 = {
    ...result0,

    aTotalRequests: a.totalRequests,
    aTotalRequestsInDisconnect: a.totalRequestsInDisconnect,
    aAvgRequestsPerSite: a.avgRequestsPerSite,
    aAvgRequestsPerSiteInDisconnect: a.avgRequestsPerSiteInDisconnect,
    aTotalTrackers: a.totalTrackers,
    aTotalTrackersInDisconnect: a.totalTrackersInDisconnect,
    aAvgTrackersPerSite: a.avgTrackersPerSite,
    aAvgTrackersPerSiteInDisconnect: a.avgTrackersPerSiteInDisconnect,
    aSitesHavingTrackers: a.sitesHavingTrackers,
    aSitesHavingTrackersInDisconnect: a.sitesHavingTrackersInDisconnect,
  };

  const b = getCategoryStats(inputEntries, bProperty);
  const result2 = {
    ...result1,

    bTotalRequests: b.totalRequests,
    bTotalRequestsInDisconnect: b.totalRequestsInDisconnect,
    bAvgRequestsPerSite: b.avgRequestsPerSite,
    bAvgRequestsPerSiteInDisconnect: b.avgRequestsPerSiteInDisconnect,
    bTotalTrackers: b.totalTrackers,
    bTotalTrackersInDisconnect: b.totalTrackersInDisconnect,
    bAvgTrackersPerSite: b.avgTrackersPerSite,
    bAvgTrackersPerSiteInDisconnect: b.avgTrackersPerSiteInDisconnect,
    bSitesHavingTrackers: b.sitesHavingTrackers,
    bSitesHavingTrackersInDisconnect: b.sitesHavingTrackersInDisconnect,
  };

  const aTrackerRankings = a.trackerRankings;
  const bTrackerRankings = b.trackerRankings;
  const result3 = {
    ...result2,

    aTrackerRankings: topTrackerRankings(aTrackerRankings),
    bTrackerRankings: topTrackerRankings(bTrackerRankings),
  };

  const aOnlyTrackerRankings = _.differenceBy(
    aTrackerRankings,
    bTrackerRankings,
    (x) => x.tracker
  );
  const bOnlyTrackerRankings = _.differenceBy(
    bTrackerRankings,
    aTrackerRankings,
    (x) => x.tracker
  );
  const result4 = {
    ...result3,

    aOnlyTrackersCount: aOnlyTrackerRankings.length,
    aOnlyTrackerRankings: topTrackerRankings(aOnlyTrackerRankings),
    bOnlyTrackersCount: bOnlyTrackerRankings.length,
    bOnlyTrackerRankings: topTrackerRankings(bOnlyTrackerRankings),
  };

  const result5 = {
    ...result4,

    aOnlyRequests: _.countBy(
      _.differenceBy(a.requests, b.requests, (x) => x.requestId),
      (x) => x.tracker
    ),
    bOnlyRequests: _.countBy(
      _.differenceBy(b.requests, a.requests, (x) => x.requestId),
      (x) => x.tracker
    ),
  };

  return result5;
}

function sampleRequestsForManualValidation(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean
) {
  const entries = applyProperty(inputEntries, property);
  const extRequests = entries
    .flatMap(({ site, trackingRequests }) =>
      trackingRequests.map(({ requestId, url }) => {
        return { site, requestId, url };
      })
    )
    .map((extRequest) => {
      const foxUrl = new FoxURL(extRequest.url);
      const { origin, pathname } = foxUrl;
      const aggregateUrl = origin + pathname;
      return { aggregateUrl, ...extRequest };
    });
  return _.sortBy(
    Object.values(
      _.groupBy(extRequests, (extRequest) => extRequest.aggregateUrl)
    ),
    (extRequestsGroup) => extRequestsGroup.length
  )
    .reverse()
    .slice(0, 20)
    .map((extRequestsGroup) => {
      const { aggregateUrl, site, requestId, url } = extRequestsGroup[0];
      return {
        aggregateUrl,
        requestsCount: extRequestsGroup.length,
        testSite: site,
        testRequestId: requestId,
        testUrl: url,
      };
    });
}
