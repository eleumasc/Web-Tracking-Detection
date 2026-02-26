import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import path from "path";
import { checkInDisconnect, initDisconnect } from "../util/Disconnect";
import { clusterObjectsBy } from "../util/cluster";
import { FoxURL } from "../foxhound/FoxURL";
import { outputDir } from "../data/outputDir";
import { readFileSync, writeFileSync } from "fs";
import { RequestTemplate } from "../core/syntacticMatching/RequestTemplate";
import { TrackingRequest } from "../core/TrackingRequest";
import { TrackingRequestsFile } from "./cmdMeasure";
import {
  siteTrackers,
  SyntacticVerifLabel,
  TrackingSiteEntry,
} from "../core/TrackingRequest";

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
      (r) => r.syntacticVerifLabel === "CONFIRMED",
    ),
    compareTaintVsNonRefutedSyntactic: compareCategories(
      entries,
      (r) => r.taint,
      (r) => r.syntactic && r.syntacticVerifLabel !== "REFUTED",
    ),

    compareSyntacticVsConfirmedSyntactic: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.syntacticVerifLabel === "CONFIRMED",
    ),
    compareSyntacticVsNonRefutedSyntactic: compareCategories(
      entries,
      (r) => r.syntactic,
      (r) => r.syntactic && r.syntacticVerifLabel !== "REFUTED",
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
      (r) => r.syntacticVerifLabel === "REFUTED",
    ),
    manValidConfirmedOnlyTaint: sampleRequestsForManualValidation(
      entries,
      (r) => r.taintVerifLabel === "CONFIRMED" && !r.syntactic,
    ),
    manValidUnknownOnlyTaint: sampleRequestsForManualValidation(
      entries,
      (r) => r.taintVerifLabel === "UNKNOWN" && !r.syntactic,
    ),
    manValidConfirmedOnlySyntactic: sampleRequestsForManualValidation(
      entries,
      (r) => !r.taint && r.syntacticVerifLabel === "CONFIRMED",
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
    confirmedRequests: countPercent((r) => r.taintVerifLabel === "CONFIRMED"),
    unknownRequests: countPercent((r) => r.taintVerifLabel === "UNKNOWN"),
  };
}

function getSyntacticVerifStats(
  inputEntries: TrackingSiteEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  const entries = applyProperty(inputEntries, property);
  const total = countCategoryRequests(
    entries,
    (r) =>
      r.syntacticVerifLabel === "CONFIRMED" ||
      r.syntacticVerifLabel === "REFUTED" ||
      r.syntacticVerifLabel === "UNKNOWN",
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
      (r) => r.syntacticVerifLabel === "NO_MATCHING_REQUESTS",
    ),
    confirmedRequests: countPercent(
      (r) => r.syntacticVerifLabel === "CONFIRMED",
    ),
    refutedRequests: countPercent((r) => r.syntacticVerifLabel === "REFUTED"),
    unknownRequests: countPercent((r) => r.syntacticVerifLabel === "UNKNOWN"),
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
  const getValueOfSyntacticVerifLabel = (
    label: SyntacticVerifLabel,
  ): number => {
    switch (label) {
      case "CONFIRMED":
        return 2;
      case "REFUTED":
        return 1;
      case "UNKNOWN":
        return 0;
      case "NO_MATCHING_REQUESTS":
        return -1;
    }
  };
  const getSyntacticVerifLabelFromValue = (
    labelValue: number,
  ): SyntacticVerifLabel => {
    switch (labelValue) {
      case 2:
        return "CONFIRMED";
      case 1:
        return "REFUTED";
      case 0:
        return "UNKNOWN";
      case -1:
        return "NO_MATCHING_REQUESTS";
      default:
        throw new Error(); // This should never happen
    }
  };

  // Cluster requests using origin + fixedUrlPathSegments
  const looseClusters = clusterObjectsBy(
    entries
      .flatMap(({ trackingRequests }) => trackingRequests)
      .filter((request) => request.syntactic)
      .map((request) => ({
        request,
        requestTemplate: RequestTemplate.fromUrlAndHoles(
          request.url,
          request.syntacticHoles!,
        ),
      })),
    (
      { requestTemplate: { origin, fixedUrlPathSegments } }, //
    ) => [origin, fixedUrlPathSegments],
  );

  // For all loose clusters:
  // 1. compute the union set of param names in holes
  // 2. intersect the param names in each template with the union set
  // 3. re-cluster requests using origin + fixedUrlPathSegments + queryParamNames
  const clusters = looseClusters.flatMap((looseCluster) => {
    const unionQueryParamNamesInHoles = looseCluster
      .flatMap(({ requestTemplate: { holes } }) => holes)
      .filter((hole) => hole.type === "QueryParameter")
      .map((hole) => hole.name)
      .sort();

    return clusterObjectsBy(
      looseCluster.map(({ request, requestTemplate }) => ({
        request,
        requestTemplate,
        queryParamNames: _.intersection(
          unionQueryParamNamesInHoles,
          requestTemplate.queryParamNames,
        ),
      })),
      ({ queryParamNames }) => queryParamNames,
    );
  });

  // For all clusters, compute the new label and populate a map request-label
  const labelMap = new WeakMap(
    clusters.flatMap((cluster): [TrackingRequest, SyntacticVerifLabel][] => {
      const labelValue = _.max(
        cluster.map(({ request }) =>
          getValueOfSyntacticVerifLabel(request.syntacticVerifLabel!),
        ),
      )!;
      const label = getSyntacticVerifLabelFromValue(labelValue);
      return cluster.map(({ request }) => [request, label]);
    }),
  );

  return entries.map(
    (entry): TrackingSiteEntry => ({
      ...entry,
      trackingRequests: entry.trackingRequests //
        .map((request): TrackingRequest => {
          if (!request.syntactic) {
            return request;
          }
          const syntacticVerifLabel = labelMap.get(request);
          assert(syntacticVerifLabel);
          return {
            ...request,
            syntacticVerifLabel,
          };
        }),
    }),
  );
}
