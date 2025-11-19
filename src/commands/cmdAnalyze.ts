import _ from "lodash";
import alterStorageStateForVerif from "../core/alterStorageStateForVerif";
import assert from "assert";
import BufferedCallback from "../util/BufferedCallback";
import currentTime from "../util/currentTime";
import execContainer from "../worker/execContainer";
import execThread from "../worker/execThread";
import FoxhoundTaintStore from "../foxhound/FoxhoundTaintStore";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import useFoxhound from "../foxhound/useFoxhound";
import useTempPath from "../util/useTempPath";
import { AnalysisLogEntry, CTAResult } from "../core/AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { cpSync } from "fs";
import { createOutputDir, getOutputPath } from "../data/outputDir";
import { FoxhoundReport } from "../foxhound/types";
import { HarController } from "../util/HarController";
import { makeTaskFromFunction } from "../worker/Task";
import { patchFoxhoundProfileStorage } from "../foxhound/patchFoxhoundProfileStorage";
import { processTaskQueue } from "../util/TaskQueue";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLL_TYPE } from "./cmdLoadSiteList";
import { StorageItem } from "../core/StorageItem";
import { toCompletion, toFlatCompletion } from "../util/Completion";
import simulateConnect, {
  SimulateConnectResult,
} from "../core/simulateConnect";

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
        execThread<ReturnType<typeof runAnalyze>>(
          makeTaskFromFunction(runAnalyze, [
            siteName,
            {
              outputName: outputCollection.name,
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

export async function runAnalyze(
  siteName: string,
  options: {
    outputName: string;
  }
): Promise<AnalysisLogEntry> {
  const { outputName } = options;

  const taintHarFile = `${siteName}+taint.har.zip`;
  const taintTaintFile = `${siteName}+taint.taint.sqlite`;
  const verifHarFile = `${siteName}+verif.har.zip`;
  const verifTaintFile = `${siteName}+verif.taint.sqlite`;

  return toCompletion(async () => {
    let auxConnectResult: SimulateConnectResult;
    let preConnectResult: SimulateConnectResult;
    let taintConnectResult: SimulateConnectResult;
    let verifConnectResult: SimulateConnectResult;
    let verifAlteredStorageItems: StorageItem[];

    await useTempPath({ localTmpDir: true }, async (profilesDir) => {
      const guestProfilesDir = "/profiles";
      const profilesBind = `${profilesDir}:${guestProfilesDir}`;

      auxConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          siteName,
          {
            userDataDir: path.join(guestProfilesDir, "aux"),
            outputName,
          },
        ]),
        { extraBinds: [profilesBind] }
      );

      preConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          siteName,
          {
            userDataDir: path.join(guestProfilesDir, "taint"),
            outputName,
          },
        ]),
        { extraBinds: [profilesBind] }
      );

      // copy profiles/taint to profiles/verif
      cpSync(path.join(profilesDir, "taint"), path.join(profilesDir, "verif"), {
        recursive: true,
      });

      taintConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          siteName,
          {
            userDataDir: path.join(guestProfilesDir, "taint"),
            outputName,
            harFile: taintHarFile,
            taintFile: taintTaintFile,
            screenshotFile: `${siteName}.png`,
          },
        ]),
        { extraBinds: [profilesBind] }
      );

      // patch firefox profile storage of profiles/verif using altered storage items
      verifAlteredStorageItems = alterStorageStateForVerif(
        auxConnectResult.storageState,
        preConnectResult.storageState,
        FoxhoundTaintStore.open(
          path.join(getOutputPath(outputName), taintTaintFile)
        ).getReports(),
        new HarController(path.join(getOutputPath(outputName), taintHarFile))
      );
      patchFoxhoundProfileStorage(
        path.join(profilesDir, "verif"),
        verifAlteredStorageItems
      );

      verifConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          siteName,
          {
            userDataDir: path.join(guestProfilesDir, "verif"),
            outputName,
            harFile: verifHarFile,
            taintFile: verifTaintFile,
          },
        ]),
        { extraBinds: [profilesBind] }
      );
    });
    assert(auxConnectResult!);
    assert(preConnectResult!);
    assert(taintConnectResult!);
    assert(verifConnectResult!);
    assert(verifAlteredStorageItems!);

    return <CTAResult>{
      aux: {
        connectResult: auxConnectResult,
      },
      pre: {
        connectResult: preConnectResult,
      },
      taint: {
        connectResult: taintConnectResult,
        harFile: taintHarFile,
        taintFile: taintTaintFile,
      },
      verif: {
        alteredStorageItems: verifAlteredStorageItems,
        connectResult: verifConnectResult,
        harFile: verifHarFile,
        taintFile: verifTaintFile,
      },
    };
  });
}

export async function runSimulateConnect(
  siteName: string,
  options: {
    userDataDir: string;
    outputName: string;
    harFile?: string;
    taintFile?: string;
    screenshotFile?: string;
  }
) {
  const { userDataDir, outputName, harFile, taintFile, screenshotFile } =
    options;

  const outputPath = createOutputDir(outputName);
  const harPath = harFile && path.join(outputPath, harFile);
  const taintPath = taintFile && path.join(outputPath, taintFile);
  const screenshotPath =
    screenshotFile && path.join(outputPath, screenshotFile);

  return bomb(ANALYSIS_TIMEOUT_MS, () =>
    useFoxhound(
      {
        userDataDir,
        taintingActive: Boolean(taintPath),
        harPath,
      },
      async (browser) => {
        let taintReportsInserter:
          | BufferedCallback<{
              serial: number;
              foxhoundReport: FoxhoundReport;
            }>
          | undefined;
        if (taintPath) {
          const taintStore = FoxhoundTaintStore.open(taintPath);
          taintReportsInserter = new BufferedCallback(50, (entries) => {
            taintStore.insertReports(entries);
          });
          let serial = 1;
          await installFoxhoundTaintReporter(browser, {
            onReport(foxhoundReport) {
              taintReportsInserter!.add({ serial: serial++, foxhoundReport });
            },
          });
        }
        try {
          return simulateConnect(browser, {
            siteName,
            screenshotPath,
          });
        } finally {
          taintReportsInserter?.flush();
        }
      }
    )
  );
}
