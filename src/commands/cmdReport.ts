import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import path from "path";
import { checkInDisconnect, initDisconnect } from "../util/Disconnect";
import { FoxURL } from "../foxhound/FoxURL";
import { outputDir } from "../data/outputDir";
import { readFileSync, writeFileSync } from "fs";
import { siteTrackers, TrackingSiteEntry } from "../core/TrackingRequest";
import { TrackingRequest } from "../core/TrackingRequest";
import { TrackingRequestsFile } from "./cmdMeasure";

export default async function cmdReport(args: { measureOutDir: string }) {
  await initDisconnect();

  const { measureOutDir } = args;

  const trackingRequestsFile = JSON.parse(
    readFileSync(path.join(measureOutDir, "trackingRequests.json")).toString(),
  ) as TrackingRequestsFile;

  const { totalSites, successSites, entries } = trackingRequestsFile;
  const reportRecord = {
    totalSites,
    successSites,
    ...getStats(relabelSyntacticVerif(entries)),
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

    unionRequests: countCategoryRequests(
      entries,
      (r) => r.taint || r.syntactic,
    ),
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

    onlyTaintVerif: getTaintVerifStats(entries, (r) => r.taint && !r.syntactic),

    syntacticVerif: getSyntacticVerifStats(entries, (r) => r.syntactic),
    intersectVerif: getSyntacticVerifStats(
      entries,
      (r) => r.taint && r.syntactic,
    ),
    onlySyntacticVerif: getSyntacticVerifStats(
      entries,
      (r) => !r.taint && r.syntactic,
    ),

    compareTaintVsSyntactic: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.syntactic,
    ),
    compareTaintVsConfirmedSyntactic: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.confirmedSyntactic,
    ),
    compareTaintVsNonRefutedSyntactic: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.syntactic && !r.refutedSyntactic,
    ),

    compareSyntacticVsConfirmedSyntactic: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.confirmedSyntactic,
    ),
    compareSyntacticVsNonRefutedSyntactic: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.syntactic && !r.refutedSyntactic,
    ),
    compareSyntacticVsUnion: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.taint || r.syntactic,
    ),

    compareUnionVsIntersect: compareCategories(
      entries,
      (r) => r.taint || r.syntactic,
      (r) => r.taint && r.syntactic,
    ),

    compareTaintPreVsAfterDisconnect: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.taint && !checkInDisconnect(r.tracker),
    ),
    compareSyntacticPreVsAfterDisconnect: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.syntactic && !checkInDisconnect(r.tracker),
    ),
    compareTaintAfterDisconnectVsSyntacticAfterDisconnect: compareCategories(
      entries,
      (r) => r.taint && !checkInDisconnect(r.tracker),
      (r) => r.syntactic && !checkInDisconnect(r.tracker),
    ),

    manValidRefutedSyntactic: sampleRequestsForManualValidation(
      entries,
      (r) => r.refutedSyntactic,
    ),
    manValidConfirmedOnlyTaint: sampleRequestsForManualValidation(
      entries,
      (r) => r.confirmedTaint && !r.syntactic,
    ),
    manValidUnknownOnlyTaint: sampleRequestsForManualValidation(
      entries,
      (r) => r.unknownTaint && !r.syntactic,
    ),
    manValidConfirmedOnlySyntactic: sampleRequestsForManualValidation(
      entries,
      (r) => !r.taint && r.confirmedSyntactic,
    ),
  };
}

function applyProperty(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean,
): TrackingSiteEntry[] {
  // do not remove entries which have no tracking requests:
  // those are required for computing avg correctly
  return inputEntries.map(
    (entry): TrackingSiteEntry => ({
      ...entry,
      trackingRequests: entry.trackingRequests //
        .filter((request) => property(request)),
    }),
  );
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

function getCategoryStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  const entries = applyProperty(inputEntries, property);
  const entriesInDisconnect = applyProperty(entries, (r) =>
    checkInDisconnect(r.tracker),
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
      Number(trackingRequests.length > 0),
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
  property: (request: TrackingRequest) => boolean,
): TrackerRanking[] {
  const entries = applyProperty(inputEntries, property);
  return _.sortBy(
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
}

function topTrackerRankings(
  trackerRankings: TrackerRanking[],
): TrackerRanking[] {
  return trackerRankings.slice(0, 10);
}

function compareCategories(
  inputEntries: TrackingSiteEntry[],
  aProperty: (request: TrackingRequest) => boolean,
  bProperty: (request: TrackingRequest) => boolean,
) {
  let result = {};

  const a = getCategoryStats(inputEntries, aProperty);
  result = {
    ...result,

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
  result = {
    ...result,

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

  const aTrackerRankings = getTrackerRankings(inputEntries, aProperty);
  const bTrackerRankings = getTrackerRankings(inputEntries, bProperty);
  result = {
    ...result,

    aTrackersCount: aTrackerRankings.length,
    aTrackerRankings: topTrackerRankings(aTrackerRankings),
    bTrackersCount: bTrackerRankings.length,
    bTrackerRankings: topTrackerRankings(bTrackerRankings),
  };

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
  result = {
    ...result,

    aOnlyTrackersCount: aOnlyTrackerRankings.length,
    aOnlyTrackerRankings: topTrackerRankings(aOnlyTrackerRankings),
    bOnlyTrackersCount: bOnlyTrackerRankings.length,
    bOnlyTrackerRankings: topTrackerRankings(bOnlyTrackerRankings),
  };

  return result;
}

function sampleRequestsForManualValidation(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  const entries = applyProperty(inputEntries, property);
  const extRequests = entries
    .flatMap(({ site, trackingRequests }) =>
      trackingRequests.map(({ requestId, url }) => {
        return { site, requestId, url };
      }),
    )
    .map((extRequest) => {
      const foxUrl = new FoxURL(extRequest.url);
      const { origin, pathname } = foxUrl;
      const aggregateUrl = origin + pathname;
      return { aggregateUrl, ...extRequest };
    });
  return _.sortBy(
    Object.values(
      _.groupBy(extRequests, (extRequest) => extRequest.aggregateUrl),
    ),
    (extRequestsGroup) => extRequestsGroup.length,
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

function relabelSyntacticVerif(
  entries: TrackingSiteEntry[],
): TrackingSiteEntry[] {
  const getUrlTemplate = (url: string): string => {
    const { origin, pathname } = new FoxURL(url);
    return origin + pathname;
  };

  const getSyntacticVerifLabel = (request: TrackingRequest): number => {
    if (request.confirmedSyntactic) {
      return 2;
    } else if (request.refutedSyntactic) {
      return 1;
    } else if (request.unknownSyntactic) {
      return 0;
    } else {
      assert(request.noMatchingRequestsSyntactic);
      return -1;
    }
  };

  const labelMap = new Map<string, number>();
  for (const request of entries.flatMap(
    ({ trackingRequests }) => trackingRequests,
  )) {
    if (!request.syntactic) {
      continue;
    }
    const urlTemplate = getUrlTemplate(request.url);
    if (labelMap.has(urlTemplate)) {
      labelMap.set(
        urlTemplate,
        Math.max(labelMap.get(urlTemplate)!, getSyntacticVerifLabel(request)),
      );
    } else {
      labelMap.set(urlTemplate, getSyntacticVerifLabel(request));
    }
  }

  return entries.map(
    (entry): TrackingSiteEntry => ({
      ...entry,
      trackingRequests: entry.trackingRequests //
        .map((request): TrackingRequest => {
          if (!request.syntactic) {
            return request;
          }
          const urlTemplate = getUrlTemplate(request.url);
          const label = labelMap.get(urlTemplate);
          assert(label !== undefined);
          return {
            ...request,
            confirmedSyntactic: label === 2,
            refutedSyntactic: label === 1,
            unknownSyntactic: label === 0,
            noMatchingRequestsSyntactic: label === -1,
          };
        }),
    }),
  );
}
