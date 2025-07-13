import _ from "lodash";
import analyze, { AnalyzeResult } from "../core/analyze";
import assert from "assert";
import BugmenotCredentialsProvider from "../core/credentials/BugmenotCredentialsProvider";
import currentTime from "../util/currentTime";
import openDocumentStore from "../core/openDocumentStore";
import path from "path";
import useFoxhound from "../util/useFoxhound";
import { bomb } from "../util/timeout";
import { BUGMENOT_FILENAME, rootDir } from "../env";
import { Completion, toCompletion } from "../util/Completion";
import { CredentialsProvider } from "../core/credentials/CredentialsProvider";
import { detectSPA } from "../core/detectSPA";
import { PROBE_COLLECTION_TYPE, ProbeEntry } from "./cmdProbe";
import { processTaskQueue } from "../util/TaskQueue";

export type AnalyzeEntry = Completion<AnalyzeResult>;

export const ANALYZE_COLLECTION_TYPE = "analyze";

const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export default async function cmdAnalyze(
  args: (
    | {
        action: "create";
        probeId: number;
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
  // assert(
  //   BITWARDEN_EXPORT_FILENAME,
  //   "BITWARDEN_EXPORT_FILENAME environment variable is not set"
  // );
  // const credentialsProvider = BitwardenExportCredentialsProvider.fromFile(
  //   path.join(rootDir, "secret", BITWARDEN_EXPORT_FILENAME)
  // );
  assert(
    BUGMENOT_FILENAME,
    "BUGMENOT_FILENAME environment variable is not set"
  );
  const credentialsProvider = BugmenotCredentialsProvider.fromFile(
    path.join(rootDir, "secret", BUGMENOT_FILENAME)
  );

  const store = openDocumentStore();

  const outputCollection =
    args.action === "create"
      ? store.createCollection(
          (() => {
            const probeCollection = store.getCollectionById(args.probeId);
            assert(probeCollection.meta.type === PROBE_COLLECTION_TYPE);
            return probeCollection.id;
          })(),
          currentTime().toString(),
          { type: ANALYZE_COLLECTION_TYPE }
        )
      : store.getCollectionById(args.outputId);
  assert(outputCollection.meta.type === ANALYZE_COLLECTION_TYPE);
  const probeCollectionId = outputCollection.parentId!;

  const tbdLoginPages = _.difference(
    // all login pages
    _.uniq(
      store
        .getDocumentsByCollection(probeCollectionId)
        .map(
          (document): ProbeEntry =>
            store.getDocumentData(document.id) as ProbeEntry
        )
        .flatMap((probeEntry): string[] => {
          const detected = detectSPA(probeEntry);
          return detected ? [detected.loginPageUrl] : [];
        })
    ),
    // processed login pages
    store
      .getDocumentsByCollection(outputCollection.id)
      .map((document) => document.name)
  );

  console.log(`Output ID: ${outputCollection.id}`);
  console.log(`${tbdLoginPages.length} login pages remaining`);

  await processTaskQueue(
    tbdLoginPages,
    { maxTasks: args.maxTasks },
    (loginPageUrl, queueIndex) => async () => {
      console.log(`begin analysis ${loginPageUrl} [${queueIndex}]`);
      const result = await runAnalyze(loginPageUrl, {
        headlessBrowser: !args.noHeadlessBrowser,
        credentialsProvider,
      });
      console.log(`end analysis ${loginPageUrl} [${queueIndex}]`);
      store.createDocument(outputCollection.id, loginPageUrl, result);
    }
  );

  process.exit(0);
}

export async function runAnalyze(
  loginPageUrl: string,
  options: {
    headlessBrowser: boolean;
    credentialsProvider: CredentialsProvider;
  }
): Promise<AnalyzeEntry> {
  const completion = await toCompletion(() => {
    const credentialsList = options.credentialsProvider.get(loginPageUrl);
    if (credentialsList.length < 1) {
      throw new Error(`No credentials found for ${loginPageUrl}`);
    }
    const credentials = credentialsList[0];
    return useFoxhound(
      { headless: options.headlessBrowser },
      async (browser) => {
        return bomb(
          () =>
            analyze(browser, {
              loginPageUrl,
              credentials,
            }),
          ANALYSIS_TIMEOUT_MS
        );
      }
    );
  });
  return completion;
}
