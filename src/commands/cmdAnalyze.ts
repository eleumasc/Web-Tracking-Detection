import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execOnChildProcess from "../multiprocessing/execOnChildProcess";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import simulateConnect from "../core/simulateConnect";
import useFoxhound from "../foxhound/useFoxhound";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { getOutputPath } from "../data/outputDir";
import { processTaskQueue } from "../util/TaskQueue";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLL_TYPE } from "./cmdLoadSiteList";
import { TaintReport } from "../foxhound/types";
import { toCompletion, toFlatCompletion } from "../util/Completion";

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
          currentTime().toString(),
          { type: ANALYSIS_LOGS_COLL_TYPE }
        )
      : store.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === ANALYSIS_LOGS_COLL_TYPE);
  const sitesCollectionId = outputCollection.parentId!;

  const tbdSites = _.differenceWith(
    // all sites
    store
      .getDocumentsWithDataByCollection<SiteEntry>(sitesCollectionId)
      .map(({ data }) => data),
    // processed sites
    store
      .getDocumentsByCollection(outputCollection.id)
      .map((document) => document.name),
    (x, y) => x.name === y
  );

  console.log(`Output ID: ${outputCollection.id}`);
  console.log(`${tbdSites.length} sites remaining`);

  await processTaskQueue(
    tbdSites,
    { maxTasks: args.maxTasks },
    (siteEntry, queueIndex) => async () => {
      const { name: siteName } = siteEntry;
      const outputPath = getOutputPath(outputCollection.name);
      console.log(`begin analysis ${siteName} [${queueIndex}]`);
      const result = await toFlatCompletion(() =>
        execOnChildProcess(runAnalyze, [
          siteEntry,
          {
            headlessBrowser: !args.noHeadlessBrowser,
            outputPath,
          },
        ])
      );
      console.log(`end analysis ${siteName} [${queueIndex}]`);
      store.createDocument(outputCollection.id, siteName, result);
    }
  );

  process.exit(0);
}

export async function runAnalyze(
  siteEntry: SiteEntry,
  options: {
    headlessBrowser: boolean;
    outputPath: string;
  }
): Promise<AnalysisLogEntry> {
  const { name: site } = siteEntry;
  const { headlessBrowser, outputPath } = options;

  const harFile = `${site}.zip`;
  const harPath = path.join(outputPath, harFile);

  return toCompletion(async () =>
    useFoxhound(
      {
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
          delayNavigationRequests: true,
        });

        const connectResult = await bomb(
          () =>
            simulateConnect(browser, {
              site,
              screenshotPath: path.join(outputPath, `${site}.png`),
            }),
          ANALYSIS_TIMEOUT_MS
        );

        const storageState = await browser.storageState();

        return {
          connectResult,
          taintReports,
          storageState,
          harFile,
        };
      }
    )
  );
}
