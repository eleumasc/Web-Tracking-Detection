import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execWorker from "../worker/execWorker";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import simulateConnect from "../core/simulateConnect";
import useFoxhound from "../foxhound/useFoxhound";
import useTempPath from "../util/useTempPath";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { createOutputDir } from "../data/outputDir";
import { isSuccess, toCompletion, toFlatCompletion } from "../util/Completion";
import { processTaskQueue } from "../util/TaskQueue";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLL_TYPE } from "./cmdLoadSiteList";
import { TaintReport } from "../foxhound/types";

export const ANALYSIS_LOGS_COLL_TYPE = "analysis_logs";

const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export default async function cmdAnalyze(
  args: (
    | {
        action: "create";
        sitesId: number;
      }
    | {
        action: "resume";
        outputId: number;
      }
  ) & {
    maxTasks: number;
    noHeadlessBrowser: boolean;
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
          { type: ANALYSIS_LOGS_COLL_TYPE }
        )
      : store.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === ANALYSIS_LOGS_COLL_TYPE);
  const sitesId = outputCollection.parentId!;

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
        execWorker(runAnalyze, [
          siteEntry,
          {
            headlessBrowser: !args.noHeadlessBrowser,
            outputName: outputCollection.name,
          },
        ])
      );
      console.log(`end analysis ${siteName} [${queueIndex}]`);

      if (isSuccess(completion)) {
        const {
          value: { taintReports },
        } = completion;
        completion.value.taintReports = [];
        const taintReportsCollection = store.createCollection(
          outputCollection.id,
          `taintReports:${siteEntry.name}`
        );
        store.bulkInsertDocuments(
          taintReportsCollection.id,
          taintReports.map((taintReport, index) => ({
            name: `${index}`,
            data: taintReport,
          }))
        );
      }
      store.createDocument(outputCollection.id, siteName, completion);
    }
  );

  process.exit(0);
}

export async function runAnalyze(
  siteEntry: SiteEntry,
  options: {
    headlessBrowser: boolean;
    outputName: string;
  }
): Promise<AnalysisLogEntry> {
  const { name: site } = siteEntry;
  const { headlessBrowser, outputName } = options;

  const outputPath = createOutputDir(outputName);

  const harFile = `${site}.zip`;
  const harPath = path.join(outputPath, harFile);

  return toCompletion(() =>
    bomb(ANALYSIS_TIMEOUT_MS, () =>
      useTempPath(
        undefined,
        async (userDataDir) => (
          await useFoxhound(
            {
              userDataDir,
              headless: headlessBrowser,
              taintingActive: false,
            },
            async (browser) => {
              await simulateConnect(browser, { site });
            }
          ),
          useFoxhound(
            {
              userDataDir,
              headless: headlessBrowser,
              harPath,
            },
            async (browser) => {
              // capture taint reports
              const taintReports: TaintReport[] = [];
              await installFoxhoundTaintReporter(browser, {
                onTaintReport: (taintReport) => {
                  taintReports.push(taintReport);
                },
              });

              const connectResult = await simulateConnect(browser, {
                site,
                screenshotPath: path.join(outputPath, `${site}.png`),
              });

              return {
                connectResult,
                taintReports,
                harFile,
              };
            }
          )
        )
      )
    )
  );
}
