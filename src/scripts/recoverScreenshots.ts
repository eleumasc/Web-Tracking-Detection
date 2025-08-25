import assert from "assert";
import { isFailure, isSuccess, toCompletion } from "../util/Completion";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import openDocumentStore from "../data/openDocumentStore";
import {
  ANALYSIS_LOGS_COLL_TYPE,
  runLoginTaintAnalysis,
} from "../commands/cmdAnalyze";
import { processTaskQueue } from "../util/TaskQueue";
import execOnChildProcess from "../multiprocessing/execOnChildProcess";
import useFoxhound from "../foxhound/useFoxhound";
import { rootDir } from "../env";
import path from "path";
import { Credential } from "../core/credential/Credential";

async function main(args: { analysisId: number }) {
  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(args.analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);

  const tbdSites = [
    ...(function* tbdSitesGenerator() {
      for (const analysisDocument of store.getDocumentsByCollection(
        analysisCollection.id
      )) {
        const site = analysisDocument.name;

        const analysisLogEntry = store.getDocumentData(
          analysisDocument.id
        ) as AnalysisLogEntry;

        if (isFailure(analysisLogEntry)) continue;
        const { value: ltaResults } = analysisLogEntry;
        const ltaResult = ltaResults.find(
          ({ loginCompletion }) =>
            isSuccess(loginCompletion) && loginCompletion.value.credentialValid
        );
        if (!ltaResult) continue;

        const { loginPageCandidate, credential } = ltaResult;
        yield { site, loginPageCandidate, credential };
      }
    })(),
  ];

  console.log(`${tbdSites.length} sites remaining`);

  await processTaskQueue(
    tbdSites,
    { maxTasks: 5 },
    (entry, queueIndex) => async () => {
      const { site: siteName, loginPageCandidate, credential } = entry;
      const screenshotPath = path.resolve(
        rootDir,
        "output",
        analysisCollection.name,
        `${siteName}.png`
      );
      console.log(`begin analysis ${siteName} [${queueIndex}]`);
      try {
        await execOnChildProcess(runLoginTaintAnalysisForRecoverScreenshots, [
          {
            loginPageCandidate,
            credential,
            screenshotPath,
          },
        ]);
      } catch (e) {
        console.log(e);
      }
      console.log(`end analysis ${siteName} [${queueIndex}]`);
    }
  );

  process.exit(0);
}

export async function runLoginTaintAnalysisForRecoverScreenshots(options: {
  loginPageCandidate: string;
  credential: Credential;
  screenshotPath: string;
}) {
  await useFoxhound({}, (browser) => runLoginTaintAnalysis(browser, options));
}

if (!process.send) {
  main(
    ((argv) => {
      return {
        analysisId: parseInt(argv[0]),
      };
    })(process.argv.slice(2))
  );
}
