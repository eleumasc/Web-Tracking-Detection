import _ from "lodash";
import currentTime from "../util/currentTime";
import DataArchive from "../data/DataArchive";
import execThread from "../worker/execThread";
import { AnalysisCompletion } from "../core/AnalysisCompletion";
import { computeTrackingRequests } from "../core/computeTrackingRequests";
import { extractDataPath, makeDataPath } from "../data/path";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { mkdirSync, writeFileSync } from "fs";
import { processTaskQueue } from "../util/TaskQueue";
import { relabelSyntacticVerif } from "../core/relabelSyntacticVerif";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";
import { toArray } from "iter-tools";
import { TrackingSiteEntry } from "../core/TrackingRequest";

export interface TrackingRequestsFile {
  totalSites: number;
  successSites: number;
  entries: TrackingSiteEntry[];
}

export default async function cmdProcess(args: {
  analyzeOutDir: string;
  maxTasks: number;
  forceNoVerif: boolean;
}) {
  const { analyzeOutDir } = args;
  const analyzeDataName = extractDataPath(analyzeOutDir);

  const dataArchive = DataArchive.open(
    makeDataPath(analyzeDataName, "data.sqlite")
  );

  const completedRecords = toArray(dataArchive.getCompletedRecords());

  const dataName = `${currentTime()}-Process`;
  mkdirSync(makeDataPath(dataName), { recursive: true });

  let totalSites = 0;
  let successSites = 0;
  let entries = new Array<TrackingSiteEntry>(completedRecords.length);

  await processTaskQueue(
    completedRecords,
    { maxTasks: args.maxTasks },
    (record, queueIndex) => async () => {
      const {
        siteEntry: { name: site },
      } = record;
      console.log(site, queueIndex);

      totalSites += 1;

      const analysisCompletion = dataArchive.getRecordData<
        AnalysisCompletion<StatefulTrackingAnalysisResult>
      >(record.id);

      if (isFailure(analysisCompletion)) return;
      const { value: staResult } = analysisCompletion;

      successSites += 1;

      const trackingRequests = await execThread<
        ReturnType<typeof computeTrackingRequests>
      >(
        makeTaskFromFunction(computeTrackingRequests, [
          {
            site,
            analyzeDataName,
            dataName,
            staResult,
            forceNoVerif: args.forceNoVerif,
          },
        ])
      );

      entries[queueIndex] = { site, trackingRequests };
    }
  );

  entries = entries.filter((x) => x);

  const trackingRequestsFile: TrackingRequestsFile = {
    totalSites,
    successSites,
    entries,
  };
  writeFileSync(
    makeDataPath(dataName, "trackingRequests.norelabel.json"),
    JSON.stringify(trackingRequestsFile)
  );
  writeFileSync(
    makeDataPath(dataName, "trackingRequests.json"),
    JSON.stringify({
      ...trackingRequestsFile,
      entries: relabelSyntacticVerif(entries),
    })
  );

  process.exit(0);
}
