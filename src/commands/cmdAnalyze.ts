import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import DataArchive from "../data/DataArchive";
import execThread from "../worker/execThread";
import { Analysis } from "../core/Analysis";
import { extractDataPath, makeDataPath } from "../data/path";
import { makeTaskFromFunction } from "../worker/Task";
import { mkdirSync } from "fs";
import { processTaskQueue } from "../util/TaskQueue";
import { readSiteList } from "../data/readSiteList";
import { runAnalyze } from "../core/runAnalyze";
import { toArray } from "iter-tools";
import { toFlatCompletion } from "../util/Completion";

export default async function cmdAnalyze(
  args: (
    | {
        action: "create";
        siteListPath: string;
        analysis: Analysis;
      }
    | {
        action: "resume";
        analyzeOutDir: string;
      }
  ) & {
    maxTasks: number;
  }
) {
  const { dataName, dataArchive } = (() => {
    if (args.action === "create") {
      const { siteListPath } = args;
      const siteListDataName = extractDataPath(siteListPath);
      const dataName = `${currentTime()}-Analyze`;
      mkdirSync(makeDataPath(dataName), { recursive: true });
      const dataArchive = DataArchive.open(
        makeDataPath(dataName, "data.sqlite")
      );
      dataArchive.setMeta("analysis", JSON.stringify(args.analysis));
      dataArchive.addRecords(readSiteList(makeDataPath(siteListDataName)));
      return { dataName, dataArchive };
    } else {
      const { analyzeOutDir } = args;
      const dataName = extractDataPath(analyzeOutDir);
      const dataArchive = DataArchive.open(
        makeDataPath(dataName, "data.sqlite")
      );
      return { dataName, dataArchive };
    }
  })();

  const analysis = (() => {
    const analysisData = dataArchive.getMeta("analysis");
    assert(analysisData);
    return JSON.parse(analysisData) as Analysis;
  })();

  const pendingRecords = toArray(dataArchive.getPendingRecords());

  console.log(`Analysis: ${JSON.stringify(analysis)}`);
  console.log(`Name: ${dataName}`);
  console.log(`${pendingRecords.length} sites remaining`);

  const abortController = new AbortController();
  process.addListener("SIGINT", () => {
    abortController.abort();
  });

  await processTaskQueue(
    pendingRecords,
    {
      maxTasks: args.maxTasks,
      abortSignal: abortController.signal,
    },
    (record, queueIndex) => async () => {
      const {
        id: recordId,
        siteEntry: { name: site },
      } = record;
      console.log(`begin analysis ${site} [${queueIndex}]`);
      const completion = await toFlatCompletion(() =>
        execThread<ReturnType<typeof runAnalyze>>(
          makeTaskFromFunction(runAnalyze, [
            {
              site,
              dataName,
              analysis,
            },
          ])
        )
      );
      console.log(`end analysis ${site} [${queueIndex}]`);

      dataArchive.updateRecordData(recordId, completion);
    }
  );

  process.exit(0);
}
