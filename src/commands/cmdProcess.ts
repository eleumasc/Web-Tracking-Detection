import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { computeTrackingRequests } from "../core/computeTrackingRequests";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { processTaskQueue } from "../util/TaskQueue";
import { relabelSyntacticVerif } from "../core/relabelSyntacticVerif";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";
import { TrackingSiteEntry } from "../core/TrackingRequest";
import { writeOutputFileSync } from "../data/outputDir";

export interface TrackingRequestsFile {
  totalSites: number;
  successSites: number;
  entries: TrackingSiteEntry[];
}

export default async function cmdProcess(args: {
  analysisId: number;
  maxTasks: number;
  forceNoVerif: boolean;
}) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);
  const { name: analysisName } = analysisCollection;

  const outputName = `${currentTime()}-Process-${analysisId}`;

  let totalSites = 0;
  let successSites = 0;
  const entries: TrackingSiteEntry[] = [];

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

      const trackingRequests = await execThread<
        ReturnType<typeof computeTrackingRequests>
      >(
        makeTaskFromFunction(computeTrackingRequests, [
          {
            site,
            analysisName,
            outputName,
            staResult,
            forceNoVerif: args.forceNoVerif,
          },
        ])
      );

      entries.push({ site, trackingRequests });
    }
  );

  const trackingRequestsFile: TrackingRequestsFile = {
    totalSites,
    successSites,
    entries,
  };
  writeOutputFileSync(
    path.join(outputName, "trackingRequests.norelabel.json"),
    JSON.stringify(trackingRequestsFile)
  );
  writeOutputFileSync(
    path.join(outputName, "trackingRequests.json"),
    JSON.stringify({
      ...trackingRequestsFile,
      entries: relabelSyntacticVerif(entries),
    })
  );

  process.exit(0);
}
