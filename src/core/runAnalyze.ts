import alterStorageStateForVerif from "./alterStorageStateForVerif";
import assert from "assert";
import BufferedCallback from "../util/BufferedCallback";
import execContainer from "../worker/execContainer";
import FoxhoundTaintStore from "../foxhound/FoxhoundTaintStore";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import path from "path";
import simulateConnect, { SimulateConnectResult } from "./simulateConnect";
import useFoxhound from "../foxhound/useFoxhound";
import useTempPath from "../util/useTempPath";
import { AnalysisLogEntry } from "./AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { cpSync } from "fs";
import { createOutputDir, getOutputPath } from "../data/outputDir";
import { FoxhoundReport } from "../foxhound/types";
import { HarController } from "../util/HarController";
import { makeTaskFromFunction } from "../worker/Task";
import { patchFoxhoundProfileStorage } from "../foxhound/patchFoxhoundProfileStorage";
import { StorageItem } from "./StorageItem";
import { toCompletion } from "../util/Completion";
import {
  Analysis,
  IdDetectionAnalysis,
  StatefulTrackingAnalysis,
} from "./Analysis";
import {
  AnalysisResult,
  IdDetectionAnalysisResult,
  StatefulTrackingAnalysisResult,
} from "./AnalysisResult";

export type RunAnalyzeOptions<T extends Analysis> = {
  siteName: string;
  outputName: string;
  analysis: T;
};

export const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export async function runAnalyze(
  options: RunAnalyzeOptions<Analysis>
): Promise<AnalysisLogEntry<AnalysisResult>> {
  const { analysis } = options;
  switch (analysis.type) {
    case "StatefulTracking":
      return runAnalyzeForStatefulTrackingAnalysis(
        options as RunAnalyzeOptions<StatefulTrackingAnalysis>
      );
    case "IdDetection":
      return runAnalyzeForIdDetectionAnalysis(
        options as RunAnalyzeOptions<IdDetectionAnalysis>
      );
  }
}

export async function runAnalyzeForStatefulTrackingAnalysis(
  options: RunAnalyzeOptions<StatefulTrackingAnalysis>
): Promise<AnalysisLogEntry<StatefulTrackingAnalysisResult>> {
  const { siteName, outputName } = options;

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

    return <StatefulTrackingAnalysisResult>{
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

export async function runAnalyzeForIdDetectionAnalysis(
  options: RunAnalyzeOptions<IdDetectionAnalysis>
): Promise<AnalysisLogEntry<IdDetectionAnalysisResult>> {
  const { siteName, outputName } = options;

  return toCompletion(async () => {
    let auxConnectResult: SimulateConnectResult;
    let preConnectResult: SimulateConnectResult;
    let primaryConnectResult: SimulateConnectResult;

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
            userDataDir: path.join(guestProfilesDir, "primary"),
            outputName,
          },
        ]),
        { extraBinds: [profilesBind] }
      );

      primaryConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          siteName,
          {
            userDataDir: path.join(guestProfilesDir, "primary"),
            outputName,
            screenshotFile: `${siteName}.png`,
          },
        ]),
        { extraBinds: [profilesBind] }
      );
    });
    assert(auxConnectResult!);
    assert(preConnectResult!);
    assert(primaryConnectResult!);

    return <IdDetectionAnalysisResult>{
      aux: {
        connectResult: auxConnectResult,
      },
      pre: {
        connectResult: preConnectResult,
      },
      primary: {
        connectResult: primaryConnectResult,
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
          return await simulateConnect(browser, {
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
