import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../core/openDocumentStore";
import probe, { ProbeResult } from "../core/probe";
import useFoxhound from "../util/useFoxhound";
import { bomb } from "../util/timeout";
import { Completion, toCompletion } from "../util/Completion";
import { FAKE_PASSWORD, FAKE_USERNAME } from "../data/credentials";
import { processTaskQueue } from "../util/TaskQueue";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLLECTION_TYPE } from "./cmdLoadSiteList";

export type ProbeEntry = {
  loginPageUrl: string;
  completion: Completion<ProbeResult>;
}[];

export const PROBE_COLLECTION_TYPE = "probe";

const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export default async function cmdProbe(
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
          { type: PROBE_COLLECTION_TYPE }
        )
      : store.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === PROBE_COLLECTION_TYPE);
  const sitesCollectionId = outputCollection.parentId!;

  const tbdSites = _.differenceWith(
    // all sites
    store
      .getDocumentsByCollection(sitesCollectionId)
      .map(
        (document): SiteEntry =>
          store.getDocumentData(document.id) as SiteEntry
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
      const { name: site } = siteEntry;
      console.log(`begin analysis ${site} [${queueIndex}]`);
      const result = await runProbe(siteEntry, {
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

export async function runProbe(
  siteEntry: SiteEntry,
  options: {
    headlessBrowser: boolean;
    username: string;
    password: string;
  }
): Promise<ProbeEntry> {
  const result: ProbeEntry = [];
  for (const loginPageUrl of siteEntry.loginPageCandidates) {
    const completion = await toCompletion(() =>
      useFoxhound({ headless: options.headlessBrowser }, async (browser) => {
        return bomb(
          () =>
            probe(browser, {
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
      completion,
    });
  }
  return result;
}
