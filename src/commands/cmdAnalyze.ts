import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../core/openDocumentStore";
import simulateLogin, { SimulateLoginResult } from "../core/simulateLogin";
import useFoxhound from "../util/useFoxhound";
import { bomb } from "../util/timeout";
import { Completion, toCompletion } from "../util/Completion";
import { FAKE_PASSWORD, FAKE_USERNAME } from "../data/credentials";
import { processTaskQueue } from "../util/TaskQueue";
import { SiteDetail } from "../core/SiteDetail";
import { SITES_COLLECTION_TYPE } from "./cmdLoadSiteList";

export type AnalyzeResult = {
  loginPageUrl: string;
  simulateLoginCompletion: Completion<SimulateLoginResult>;
}[];

export const LOGIN_TAINT_ANALYSIS_COLLECTION_TYPE = "login-taint-analysis";

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
            assert(sitesCollection.meta.type === SITES_COLLECTION_TYPE);
            return sitesCollection.id;
          })(),
          currentTime().toString(),
          { type: LOGIN_TAINT_ANALYSIS_COLLECTION_TYPE }
        )
      : store.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === LOGIN_TAINT_ANALYSIS_COLLECTION_TYPE);
  const sitesCollectionId = outputCollection.parentId!;

  const tbdSites = _.differenceWith(
    // all sites
    store
      .getDocumentsByCollection(sitesCollectionId)
      .map(
        (document): SiteDetail =>
          store.getDocumentData(document.id) as SiteDetail
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
    (siteDetail, queueIndex) => async () => {
      const { name: site } = siteDetail;
      console.log(`begin analysis ${site} [${queueIndex}]`);
      const result = await runAnalyze(siteDetail, {
        headlessBrowser: !args.noHeadlessBrowser,
        username: FAKE_USERNAME,
        password: FAKE_PASSWORD,
      });
      console.log(`end analysis ${site} [${queueIndex}]`);
      store.createDocument(outputCollection.id, site, result);
    }
  );

  process.exit(0);
}

export async function runAnalyze(
  siteDetail: SiteDetail,
  options: {
    headlessBrowser: boolean;
    username: string;
    password: string;
  }
): Promise<AnalyzeResult> {
  const result: AnalyzeResult = [];
  for (const loginPageUrl of siteDetail.loginPageCandidates) {
    const completion = await toCompletion(() =>
      useFoxhound({ headless: options.headlessBrowser }, async (browser) => {
        const page = await browser.newPage();
        return bomb(
          () =>
            simulateLogin(page, {
              loginPageUrl,
              username: options.username,
              password: options.password,
            }),
          ANALYSIS_TIMEOUT_MS
        );
      })
    );
    result.push({
      loginPageUrl,
      simulateLoginCompletion: completion,
    });
  }
  return result;
}
