import _ from "lodash";
import assert from "assert";
import BugmenotCredentialProvider from "../core/credential/BugmenotCredentialProvider";
import currentTime from "../util/currentTime";
import installFoxhoundTaintReporting from "../foxhound/installFoxhoundTaintReporting";
import openDocumentStore from "../data/openDocumentStore";
import simulateLogin, { SimulateLoginError } from "../core/simulateLogin";
import useFoxhound from "../foxhound/useFoxhound";
import { AnalysisLogEntry, LTAResult } from "../core/AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { BrowserContext } from "playwright";
import { Credential } from "../core/credential/Credential";
import { CredentialProvider } from "../core/credential/CredentialProvider";
import { isFailure, isSuccess, toCompletion } from "../util/Completion";
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
  const credentialProvider = new BugmenotCredentialProvider();

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
    _.uniq(
      store
        .getDocumentsByCollection(sitesCollectionId)
        .map(
          (document): SiteEntry =>
            store.getDocumentData(document.id) as SiteEntry
        )
    ),
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
      console.log(`begin analysis ${siteName} [${queueIndex}]`);
      const result = await runAnalyze(siteEntry, {
        headlessBrowser: !args.noHeadlessBrowser,
        credentialProvider,
      });
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
    credentialProvider: CredentialProvider;
  }
): Promise<AnalysisLogEntry> {
  const { loginPageCandidates } = siteEntry;
  const { headlessBrowser, credentialProvider } = options;

  return toCompletion(async () => {
    const ltaResults: LTAResult[] = [];

    outerLoop: for (const loginPageCandidate of loginPageCandidates) {
      const credentials = await credentialProvider.get(loginPageCandidate);
      for (const credential of credentials) {
        const ltaResult = await useFoxhound(
          { headless: headlessBrowser },
          async (browser) =>
            runLoginTaintAnalysis(browser, loginPageCandidate, credential)
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

    // Return the analysis results that
    return ltaResults;
  });
}

async function runLoginTaintAnalysis(
  browser: BrowserContext,
  loginPageCandidate: string,
  credential: Credential
): Promise<LTAResult> {
  // capture taint reports
  const taintReports: TaintReport[] = [];
  await installFoxhoundTaintReporting(browser, {
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
