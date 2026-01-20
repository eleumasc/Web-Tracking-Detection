import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { processTaskQueue } from "../util/TaskQueue";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";
import { TrackingRequest } from "../core/TrackingRequest";
import { writeOutputFileSync } from "../data/outputDir";
import {
  processTrackingRequests,
  SiteTrackingRequestsEntry,
} from "../core/processTrackingRequests";

export default async function cmdMeasure(args: {
  analysisId: number;
  maxTasks: number;
}) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);
  const { name: analysisName } = analysisCollection;

  const outputName = `${currentTime()}-Measure-${analysisId}`;

  let totalSites = 0;
  let successSites = 0;
  const entries: SiteTrackingRequestsEntry[] = [];

  await processTaskQueue(
    store.getDocumentsByCollection(analysisCollection.id),
    { maxTasks: args.maxTasks },
    (analysisDocument, queueIndex) => async () => {
      const site = analysisDocument.name;
      console.log(site, queueIndex);

      totalSites += 1;

      const analysisLogEntry = store.getDocumentData<
        AnalysisLogEntry<StatefulTrackingAnalysisResult>
      >(analysisDocument.id);

      if (isFailure(analysisLogEntry)) return;
      const { value: staResult } = analysisLogEntry;

      successSites += 1;

      const entry = await execThread<
        ReturnType<typeof processTrackingRequests>
      >(
        makeTaskFromFunction(processTrackingRequests, [
          {
            site,
            analysisName,
            outputName,
            staResult,
          },
        ]),
      );

      entries.push(entry);
    },
  );

  const reportRecord = {
    totalSites,
    successSites,
    ...getStats(entries),
  };
  console.log(reportRecord);
  writeOutputFileSync(
    path.join(outputName, "report.json"),
    JSON.stringify(reportRecord),
  );

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
    __intersect: getCategoryStats(entries, (r) => r.taint && r.syntactic),
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
  const { requests } = entry;
  return _.uniq(requests.map((request) => request.tracker));
}

function countCategoryRequests(
  inputEntries: SiteTrackingRequestsEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  return _.sumBy(
    inputEntries,
    ({ requests }) => requests.filter((request) => property(request)).length,
  );
}

function getCategoryStats(
  inputEntries: SiteTrackingRequestsEntry[],
  property: (request: TrackingRequest) => boolean,
) {
  const entries = inputEntries.map((entry) => {
    const { requests } = entry;
    return {
      ...entry,
      requests: requests.filter((request) => property(request)),
    };
  });
  return {
    totalRequests: _.sumBy(entries, ({ requests }) => requests.length),
    avgRequestsPerSite: _.meanBy(entries, ({ requests }) => requests.length),
    maxRequestsPerSite: _.max(entries.map(({ requests }) => requests.length)),
    sitesHavingTrackers: _.sumBy(entries, ({ requests }) =>
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
        entry.requests
          .filter((request) => !property(request))
          .map(({ tracker }) => tracker),
      ),
    ),
  );
}
