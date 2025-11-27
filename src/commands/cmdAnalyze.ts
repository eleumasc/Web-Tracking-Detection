import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import openDocumentStore from "../data/openDocumentStore";
import { Analysis } from "../core/Analysis";
import { makeTaskFromFunction } from "../worker/Task";
import { processTaskQueue } from "../util/TaskQueue";
import { runAnalyze } from "../core/runAnalyze";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLL_TYPE } from "./cmdLoadSiteList";
import { toFlatCompletion } from "../util/Completion";

export const ANALYSIS_LOGS_COLL_TYPE = "analysis_logs";

export default async function cmdAnalyze(
  args: (
    | {
        action: "create";
        sitesId: number;
        analysis: Analysis;
      }
    | {
        action: "resume";
        outputId: number;
      }
  ) & {
    maxTasks: number;
  }
) {
  const store = openDocumentStore();

  const outputCollection =
    args.action === "create"
      ? store.createCollection(
          (() => {
            const sitesCollection = store.getCollectionById(args.sitesId);
            assert(sitesCollection.meta.type === SITES_COLL_TYPE);
            return sitesCollection.id;
          })(),
          `${currentTime()}-Analyze-${args.sitesId}`,
          {
            type: ANALYSIS_LOGS_COLL_TYPE,
            analysis: args.analysis,
          }
        )
      : store.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === ANALYSIS_LOGS_COLL_TYPE);
  const sitesId = outputCollection.parentId!;

  const analysis = outputCollection.meta.analysis as Analysis;

  const tbdSites = _.differenceWith(
    // all sites
    store
      .getDocumentsWithDataByCollection<SiteEntry>(sitesId)
      .map(({ data }) => data),
    // processed sites
    store
      .getDocumentsByCollection(outputCollection.id)
      .map((document) => document.name),
    (x, y) => x.name === y
  );

  console.log(`Analysis: ${JSON.stringify(analysis)}`);
  console.log(`Output ID: ${outputCollection.id}`);
  console.log(`${tbdSites.length} sites remaining`);

  const abortController = new AbortController();
  process.addListener("SIGINT", () => {
    abortController.abort();
  });

  await processTaskQueue(
    tbdSites,
    {
      maxTasks: args.maxTasks,
      abortSignal: abortController.signal,
    },
    (siteEntry, queueIndex) => async () => {
      const { name: siteName } = siteEntry;
      console.log(`begin analysis ${siteName} [${queueIndex}]`);
      const completion = await toFlatCompletion(() =>
        execThread<ReturnType<typeof runAnalyze>>(
          makeTaskFromFunction(runAnalyze, [
            {
              siteName,
              outputName: outputCollection.name,
              analysis,
            },
          ])
        )
      );
      console.log(`end analysis ${siteName} [${queueIndex}]`);

      store.createDocument(outputCollection.id, siteName, completion);
    }
  );

  process.exit(0);
}
