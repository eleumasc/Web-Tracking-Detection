import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import openDocumentStore from "../data/openDocumentStore";
import simulateLogin, { SimulateLoginError } from "../core/simulateLogin";
import useFoxhound from "../foxhound/useFoxhound";
import { AnalysisLogEntry, LTAResult } from "../core/AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { BrowserContext } from "playwright";
import { Credential } from "../core/credential/Credential";
import {
  isFailure,
  isSuccess,
  toCompletion,
  toFlatCompletion,
} from "../util/Completion";
import { processTaskQueue } from "../util/TaskQueue";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLL_TYPE } from "./cmdLoadSiteList";
import { TaintReport } from "../foxhound/types";
import execOnChildProcess from "../multiprocessing/execOnChildProcess";
import path from "path";
import { rootDir } from "../env";

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
      .getDocumentsWithDataByCollection(sitesCollectionId)
      .map(({ data }): SiteEntry => data),
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
      const screenshotPath = path.resolve(
        rootDir,
        "output",
        outputCollection.name,
        `${siteEntry.name}.png`
      );
      console.log(`begin analysis ${siteName} [${queueIndex}]`);
      const result = await toFlatCompletion(() =>
        execOnChildProcess(runAnalyze, [
          siteEntry,
          {
            headlessBrowser: !args.noHeadlessBrowser,
            screenshotPath,
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
    screenshotPath?: string;
  }
): Promise<AnalysisLogEntry> {
  const { loginPageCandidates, credentials } = siteEntry;
  const { headlessBrowser, screenshotPath } = options;

  return toCompletion(async () => {
    const ltaResults: LTAResult[] = [];

    outerLoop: for (const loginPageCandidate of _.uniq(loginPageCandidates)) {
      for (const credential of credentials) {
        const ltaResult = await useFoxhound(
          { headless: headlessBrowser },
          async (browser) =>
            runLoginTaintAnalysis(browser, {
              loginPageCandidate,
              credential,
              screenshotPath,
            })
        );
        ltaResults.push(ltaResult);

        const { loginCompletion } = ltaResult;
        // If loginCompletion is a failure of type SimulateLoginError, stop analyzing this login page candidate.
        if (isFailure(loginCompletion)) {
          continue outerLoop;
        }
        const {
          value: { credentialValid },
        } = loginCompletion;
        // If the credentials are valid, stop analyzing this site.
        if (credentialValid) {
          return ltaResults;
        }
      }
    }

    // Return the analysis log reporting all login attempts on this site.
    return ltaResults;
  });
}

export async function runLoginTaintAnalysis(
  browser: BrowserContext,
  options: {
    loginPageCandidate: string;
    credential: Credential;
    screenshotPath?: string;
  }
): Promise<LTAResult> {
  const { loginPageCandidate, credential, screenshotPath } = options;

  // capture taint reports
  const taintReports: TaintReport[] = [];
  await installFoxhoundTaintReporter(browser, {
    onTaintReport: (taintReport) => {
      taintReports.push(taintReport);
    },
    delayNavigationRequests: true,
  });

  const loginCompletion = await toCompletion(
    () =>
      bomb(
        () =>
          simulateLogin(browser, {
            loginPageCandidate,
            credential,
            screenshotPath,
          }),
        ANALYSIS_TIMEOUT_MS
      ),
    {
      failureOnlyIf: (e) => e instanceof SimulateLoginError,
    }
  );

  const credentialValid =
    isSuccess(loginCompletion) && loginCompletion.value.credentialValid;

  let credentialValidExtra = {};
  if (credentialValid) {
    const storageState = await browser.storageState();
    credentialValidExtra = {
      taintReports,
      storageState,
    };
  }

  return {
    loginPageCandidate,
    credential,
    loginCompletion,
    ...credentialValidExtra,
  };
}
