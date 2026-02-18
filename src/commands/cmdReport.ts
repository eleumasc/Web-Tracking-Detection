import _ from "lodash";
import currentTime from "../util/currentTime";
import path from "path";
import { getDisconnect, initDisconnect } from "../util/Disconnect";
import { outputDir } from "../data/outputDir";
import { readFileSync, writeFileSync } from "fs";
import { siteTrackers, TrackingSiteEntry } from "../core/TrackingRequest";
import { TrackingRequest } from "../core/TrackingRequest";
import { TrackingRequestsFile } from "./cmdMeasure";

export default async function cmdReport(args: { measureOutDir: string }) {
  await initDisconnect();

  const { measureOutDir } = args;

  const trackingRequestsLogEntry = JSON.parse(
    readFileSync(path.join(measureOutDir, "trackingRequests.json")).toString(),
  ) as TrackingRequestsFile;

  const { totalSites, successSites, entries } = trackingRequestsLogEntry;
  const reportRecord = {
    totalSites,
    successSites,
    ...getStats(entries),
  };
  writeFileSync(
    path.join(
      outputDir,
      `${currentTime()}-Report-${path.basename(measureOutDir)}.json`,
    ),
    JSON.stringify(reportRecord),
  );
  console.log(reportRecord);

  process.exit(0);
}

function getStats(entries: TrackingSiteEntry[]) {
  return {
    taintRequests: countCategoryRequests(entries, (r) => r.taint),
    syntacticRequests: countCategoryRequests(entries, (r) => r.syntactic),

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

    taintVerif: getTaintVerifStats(entries, (r) => r.taint),

    syntacticVerif: getSyntacticVerifStats(entries, (r) => r.syntactic),
    intersectVerif: getSyntacticVerifStats(
      entries,
      (r) => r.taint && r.syntactic,
    ),
    onlySyntacticVerif: getSyntacticVerifStats(
      entries,
      (r) => !r.taint && r.syntactic,
    ),

    trackersTaintVsSyntactic: compareTrackersByCategory(
      entries,
      (r) => r.taint,
      (r) => r.syntactic,
    ),
    trackersTaintVsConfirmedSyntactic: compareTrackersByCategory(
      entries,
      (r) => r.taint,
      (r) => r.confirmedSyntactic,
    ),
    trackersTaintVsNonRefutedSyntactic: compareTrackersByCategory(
      entries,
      (r) => r.taint,
      (r) => r.syntactic && !r.refutedSyntactic,
    ),

    trackersSyntacticVsConfirmedSyntactic: compareTrackersByCategory(
      entries,
      (r) => r.syntactic,
      (r) => r.confirmedSyntactic,
    ),
    trackersSyntacticVsNonRefutedSyntactic: compareTrackersByCategory(
      entries,
      (r) => r.syntactic,
      (r) => r.syntactic && !r.refutedSyntactic,
    ),
  };
}

function applyProperty(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean,
): TrackingSiteEntry[] {
  return inputEntries.map((entry): TrackingSiteEntry => {
    const { trackingRequests: requests } = entry;
    return {
      ...entry,
      trackingRequests: requests.filter((request) => property(request)),
    };
  });
}

function countCategoryRequests(
  inputEntries: TrackingSiteEntry[],
  property?: (request: TrackingRequest) => boolean,
): number {
  return _.sumBy(inputEntries, ({ trackingRequests: requests }) =>
    property
      ? requests.filter((request) => property(request)).length
      : requests.length,
  );
}

function percent(count: number, total: number): string {
  return `${Math.round((count / total) * 100)}%`;
}

function getTaintVerifStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  const entries = applyProperty(inputEntries, property);
  const total = countCategoryRequests(entries);
  const countPercent = (
    countProperty: (request: TrackingRequest) => boolean,
  ) => {
    const count = countCategoryRequests(entries, countProperty);
    return [count, percent(count, total)];
  };
  return {
    confirmedRequests: countPercent((r) => r.confirmedTaint),
    unknownRequests: countPercent((r) => r.unknownTaint),
  };
}

function getSyntacticVerifStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  const entries = applyProperty(inputEntries, property);
  const total = countCategoryRequests(
    entries,
    (r) => r.confirmedSyntactic || r.refutedSyntactic || r.unknownSyntactic,
  );
  const countPercent = (
    countProperty: (request: TrackingRequest) => boolean,
  ) => {
    const count = countCategoryRequests(entries, countProperty);
    return [count, percent(count, total)];
  };
  return {
    noMatchingRequestsRequests: countCategoryRequests(
      entries,
      (r) => r.noMatchingRequestsSyntactic,
    ),
    confirmedRequests: countPercent((r) => r.confirmedSyntactic),
    refutedRequests: countPercent((r) => r.refutedSyntactic),
    unknownRequests: countPercent((r) => r.unknownSyntactic),
  };
}

function compareTrackersByCategory(
  inputEntries: TrackingSiteEntry[],
  aProperty: (request: TrackingRequest) => boolean,
  bProperty: (request: TrackingRequest) => boolean,
) {
  const aEntries = applyProperty(inputEntries, aProperty);
  const bEntries = applyProperty(inputEntries, bProperty);

  let result = {};

  const sitesHavingTrackers = (entries: TrackingSiteEntry[]): number =>
    _.sumBy(entries, ({ trackingRequests: requests }) =>
      Number(requests.length > 0),
    );
  const totalTrackers = (entries: TrackingSiteEntry[]): number =>
    _.uniq(entries.flatMap((entry) => siteTrackers(entry))).length;
  const avgTrackersPerSite = (entries: TrackingSiteEntry[]): number =>
    _.meanBy(entries, (entry) => siteTrackers(entry).length);

  result = {
    ...result,

    aSitesHavingTrackers: sitesHavingTrackers(aEntries),
    aTotalTrackers: totalTrackers(aEntries),
    aAvgTrackersPerSite: avgTrackersPerSite(aEntries),

    bSitesHavingTrackers: sitesHavingTrackers(bEntries),
    bTotalTrackers: totalTrackers(bEntries),
    bAvgTrackersPerSite: avgTrackersPerSite(bEntries),
  };

  interface TrackerRanking {
    tracker: string;
    rank: number;
    popularity: number;
    inDisconnect: boolean;
  }
  const checkInDisconnect = (tracker: string): boolean => {
    const disconnect = getDisconnect();
    return (
      disconnect["Advertising"].includes(tracker) ||
      disconnect["Analytics"].includes(tracker)
    );
  };
  const trackerRankings = (entries: TrackingSiteEntry[]): TrackerRanking[] =>
    _.sortBy(
      _.entries(_.countBy(entries.flatMap((entry) => siteTrackers(entry)))),
      ([_, popularity]) => popularity,
    )
      .reverse()
      .map(([tracker, popularity], index) => ({
        tracker,
        rank: index + 1,
        popularity,
        inDisconnect: checkInDisconnect(tracker),
      }));

  const aTrackerRankings = trackerRankings(aEntries);
  const bTrackerRankings = trackerRankings(bEntries);

  const aOnlyTrackerRankings = _.differenceBy(
    aTrackerRankings,
    bTrackerRankings,
    (x) => x.tracker,
  );
  const bOnlyTrackerRankings = _.differenceBy(
    bTrackerRankings,
    aTrackerRankings,
    (x) => x.tracker,
  );

  const top = (trackerRankings: TrackerRanking[]) =>
    trackerRankings.slice(0, 10);
  const inDisconnect = (trackerRankings: TrackerRanking[]) =>
    trackerRankings.filter((x) => x.inDisconnect);

  result = {
    ...result,

    aTrackersCount: aTrackerRankings.length,
    aTrackersInDisconnectCount: inDisconnect(aTrackerRankings).length,
    aTrackerRankings: top(aTrackerRankings),
    bTrackersCount: bTrackerRankings.length,
    bTrackersInDisconnectCount: inDisconnect(bTrackerRankings).length,
    bTrackerRankings: top(bTrackerRankings),

    aOnlyTrackersCount: aOnlyTrackerRankings.length,
    aOnlyTrackersInDisconnectCount: inDisconnect(aOnlyTrackerRankings).length,
    aOnlyTrackerRankings: top(aOnlyTrackerRankings),
    bOnlyTrackersCount: bOnlyTrackerRankings.length,
    bOnlyTrackersInDisconnectCount: inDisconnect(bOnlyTrackerRankings).length,
    bOnlyTrackerRankings: top(bOnlyTrackerRankings),
  };

  return result;
}
