import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import yargs from "yargs";
import { ANALYSIS_LOGS_COLL_TYPE } from "../commands/cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { doTestComputeTrackingRequests } from "../core/doTestComputeTrackingRequests";
import { hideBin } from "yargs/helpers";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { processTaskQueue } from "../util/TaskQueue";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";
import { writeOutputFileSync } from "../data/outputDir";

async function main(args: { analysisId: number; maxTasks: number }) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);
  const { name: analysisName } = analysisCollection;

  const outputName = `${currentTime()}-testComputeTrackingRequests-${analysisId}`;

  let totalSites = 0;
  let successSites = 0;
  const entries: ReturnType<typeof doTestComputeTrackingRequests>[] = [];

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

      entries.push(entry);
    },
  );

  const reportRecord = {
    totalSites,
    successSites,
    taintedRequestsCount: _.sumBy(
      entries,
      (entry) => entry.taintedRequestsCount,
    ),
    matchedRequestsCount: _.sumBy(
      entries,
      (entry) => entry.matchedRequestsCount,
    ),
    intersectRequestsCount: _.sumBy(
      entries,
      (entry) => entry.intersectRequestsCount,
    ),
    onlyTaintRequestsCount: _.sumBy(
      entries,
      (entry) => entry.onlyTaintRequestsCount,
    ),
    onlySyntacticRequestsCount: _.sumBy(
      entries,
      (entry) => entry.onlySyntacticRequestsCount,
    ),
  };
  console.log(reportRecord);
  writeOutputFileSync(
    path.join(outputName, "report.json"),
    JSON.stringify(reportRecord),
  );

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
