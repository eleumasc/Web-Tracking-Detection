import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import openDocumentStore from "../data/openDocumentStore";
import yargs from "yargs";
import { ANALYSIS_LOGS_COLL_TYPE } from "../commands/cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { doTestComputeTrackingRequests } from "../core/doTestComputeTrackingRequests";
import { hideBin } from "yargs/helpers";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { processTaskQueue } from "../util/TaskQueue";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";

async function main(args: { analysisId: number; maxTasks: number }) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);
  const { name: analysisName } = analysisCollection;

  const outputName = `${currentTime()}-testComputeTaintedRequests-${analysisId}`;

  let totalSites = 0;
  let successSites = 0;
  let taintedRequestsCount = 0;
  let matchedRequestsCount = 0;

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

      const s = await execThread<
        ReturnType<typeof doTestComputeTrackingRequests>
      >(
        makeTaskFromFunction(doTestComputeTrackingRequests, [
          {
            site,
            analysisName,
            outputName,
            staResult,
          },
        ]),
      );

      taintedRequestsCount += s.taintedRequestsCount;
      matchedRequestsCount += s.matchedRequestsCount;
    },
  );

  console.log({
    totalSites,
    successSites,
    taintedRequestsCount,
    matchedRequestsCount,
  });

  process.exit(0);
}

yargs(hideBin(process.argv))
  .command(
    "$0 <analysisId>",
    "Test computeTaintedRequests",
    (yargs) =>
      yargs
        .positional("analysisId", {
          type: "number",
          demandOption: true,
        })
        .option("maxTasks", {
          type: "number",
          default: 1,
        }),
    (args) => main(args),
  )
  .parse();
