import assert from "assert";
import execContainer from "../worker/execContainer";
import Flatted from "flatted";
import FoxhoundTaintArchive from "../foxhound/FoxhoundTaintArchive";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import path from "path";
import simulateConnect, { SimulateConnectResult } from "./simulateConnect";
import useFoxhound from "../foxhound/useFoxhound";
import useTempPath from "../util/useTempPath";
import { Analysis, StatefulTrackingAnalysis } from "./Analysis";
import { AnalysisLogEntry } from "./AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { cpSync } from "fs";
import { createOutputDir, writeOutputFileSync } from "../data/outputDir";
import { FoxhoundReport } from "../foxhound/types";
import { makeTaskFromFunction } from "../worker/Task";
import { patchFoxhoundProfileStorage } from "../foxhound/patchFoxhoundProfileStorage";
import { processFlows } from "./processFlows";
import { toCompletion } from "../util/Completion";
import {
  AnalysisResult,
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
  const taintFlowsFile = `${siteName}+TF.json`;
  const syntacticFlowsFile = `${siteName}+SF.json`;
  const storageCanariesFile = `${siteName}+C.json`;

  return toCompletion(async () => {
    let aux: StatefulTrackingAnalysisResult["aux"];
    let pre: StatefulTrackingAnalysisResult["pre"];
    let taint: StatefulTrackingAnalysisResult["taint"];
    let verif: StatefulTrackingAnalysisResult["verif"];

    await useTempPath({ localTmpDir: true }, async (profilesDir) => {
      const guestProfilesDir = "/profiles";
      const profilesBind = `${profilesDir}:${guestProfilesDir}`;

      const auxConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          siteName,
          {
            userDataDir: path.join(guestProfilesDir, "aux"),
            outputName,
          },
        ]),
        { extraBinds: [profilesBind] }
      );
      aux = { connectResult: auxConnectResult };

      const preConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          siteName,
          {
            userDataDir: path.join(guestProfilesDir, "taint"),
            outputName,
          },
        ]),
        { extraBinds: [profilesBind] }
      );
      pre = { connectResult: preConnectResult };

      // copy profiles/taint to profiles/verif
      cpSync(path.join(profilesDir, "taint"), path.join(profilesDir, "verif"), {
        recursive: true,
      });

      const taintConnectResult: SimulateConnectResult = await execContainer(
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
      taint = {
        connectResult: taintConnectResult,
        harFile: taintHarFile,
        taintFile: taintTaintFile,
      };

      if (options.analysis.noVerif) return;

      const {
        taintAbstractFlows,
        syntacticAbstractFlows,
        storageCanariesEntries,
      } = processFlows({
        analysisName: outputName,
        auxConnectResult,
        preConnectResult,
        taintHarFile,
        taintTaintFile,
      });

      // patch firefox profile storage of profiles/verif using altered storage items
      patchFoxhoundProfileStorage(
        path.join(profilesDir, "verif"),
        storageCanariesEntries.map(({ storageItem }) => storageItem)
      );

      const verifConnectResult: SimulateConnectResult = await execContainer(
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
      verif = {
        storageCanariesFile,
        connectResult: verifConnectResult,
        harFile: verifHarFile,
        taintFile: verifTaintFile,
        taintFlowsFile,
        syntacticFlowsFile,
      };

      writeOutputFileSync(
        path.join(outputName, taintFlowsFile),
        Flatted.stringify(taintAbstractFlows)
      );
      writeOutputFileSync(
        path.join(outputName, syntacticFlowsFile),
        Flatted.stringify(syntacticAbstractFlows)
      );
      writeOutputFileSync(
        path.join(outputName, storageCanariesFile),
        Flatted.stringify(storageCanariesEntries)
      );
    });
    assert(aux!);
    assert(pre!);
    assert(taint!);

    return <StatefulTrackingAnalysisResult>{ aux, pre, taint, verif };
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
        let foxhoundReports: FoxhoundReport[] | undefined;
        if (taintPath) {
          foxhoundReports = [];
          await installFoxhoundTaintReporter(browser, {
            onReport(foxhoundReport) {
              foxhoundReports!.push(foxhoundReport);
            },
          });
        }
        try {
          return await simulateConnect(browser, {
            siteName,
            screenshotPath,
          });
        } finally {
          if (taintPath) {
            new FoxhoundTaintArchive(taintPath).insertReports(foxhoundReports!);
          }
        }
      }
    )
  );
}
