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
import { makeTaskFromFunction } from "../worker/Task";
import { patchFoxhoundProfileStorage } from "../foxhound/patchFoxhoundProfileStorage";
import { processFlows } from "./processFlows";
import { toCompletion } from "../util/Completion";
import {
  AnalysisResult,
  StatefulTrackingAnalysisResult,
} from "./AnalysisResult";

export type RunAnalyzeOptions<T extends Analysis> = {
  site: string;
  outputName: string;
  analysis: T;
};

export const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export async function runAnalyze(
  options: RunAnalyzeOptions<Analysis>,
): Promise<AnalysisLogEntry<AnalysisResult>> {
  const { analysis } = options;
  switch (analysis.type) {
    case "StatefulTracking":
      return runAnalyzeForStatefulTrackingAnalysis(
        options as RunAnalyzeOptions<StatefulTrackingAnalysis>,
      );
  }
}

export async function runAnalyzeForStatefulTrackingAnalysis(
  options: RunAnalyzeOptions<StatefulTrackingAnalysis>,
): Promise<AnalysisLogEntry<StatefulTrackingAnalysisResult>> {
  const { site, outputName } = options;

  const taintHarFile = `${site}+taint.har.zip`;
  const taintTaintFile = `${site}+taint.taint.sqlite`;
  const verifHarFile = `${site}+verif.har.zip`;
  const taintFlowsFile = `${site}+TF.json`;
  const syntacticFlowsFile = `${site}+SF.json`;
  const modifiedStorageItemsFile = `${site}+C.json`;
  const auxVerifHarFile = `${site}+auxVerif.har.zip`;

  return toCompletion(async () => {
    let aux: StatefulTrackingAnalysisResult["aux"];
    let pre: StatefulTrackingAnalysisResult["pre"];
    let taint: StatefulTrackingAnalysisResult["taint"];
    let verif: StatefulTrackingAnalysisResult["verif"];
    let auxVerif: StatefulTrackingAnalysisResult["auxVerif"];

    await useTempPath({ localTmpDir: true }, async (profilesDir) => {
      const guestProfilesDir = "/profiles";
      const profilesBind = `${profilesDir}:${guestProfilesDir}`;

      const auxConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(guestProfilesDir, "aux"),
            outputName,
          },
        ]),
        { extraBinds: [profilesBind] },
      );
      aux = { connectResult: auxConnectResult };

      const preConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(guestProfilesDir, "taint"),
            outputName,
          },
        ]),
        { extraBinds: [profilesBind] },
      );
      pre = { connectResult: preConnectResult };

      // copy profiles/taint to profiles/verif
      cpSync(path.join(profilesDir, "taint"), path.join(profilesDir, "verif"), {
        recursive: true,
      });

      const taintConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(guestProfilesDir, "taint"),
            outputName,
            harFile: taintHarFile,
            taintFile: taintTaintFile,
            screenshotFile: `${site}.png`,
          },
        ]),
        { extraBinds: [profilesBind] },
      );
      taint = {
        connectResult: taintConnectResult,
        harFile: taintHarFile,
        taintFile: taintTaintFile,
      };

      if (options.analysis.noVerif) return;

      const { taintFlows, syntacticFlows, modifiedStorageItems } = processFlows(
        {
          analysisName: outputName,
          auxConnectResult,
          preConnectResult,
          taintHarFile,
          taintTaintFile,
        },
      );

      patchFoxhoundProfileStorage(
        path.join(profilesDir, "verif"),
        modifiedStorageItems.map(({ storageItem }) => storageItem),
      );
      const verifConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(guestProfilesDir, "verif"),
            outputName,
            harFile: verifHarFile,
          },
        ]),
        { extraBinds: [profilesBind] },
      );
      verif = {
        connectResult: verifConnectResult,
        harFile: verifHarFile,
        taintFlowsFile,
        syntacticFlowsFile,
        modifiedStorageItemsFile,
      };
      writeOutputFileSync(
        path.join(outputName, taintFlowsFile),
        Flatted.stringify(taintFlows),
      );
      writeOutputFileSync(
        path.join(outputName, syntacticFlowsFile),
        Flatted.stringify(syntacticFlows),
      );
      writeOutputFileSync(
        path.join(outputName, modifiedStorageItemsFile),
        Flatted.stringify(modifiedStorageItems),
      );

      patchFoxhoundProfileStorage(
        path.join(profilesDir, "aux"),
        modifiedStorageItems.map(({ storageItem }) => storageItem),
      );
      const auxVerifConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(guestProfilesDir, "aux"),
            outputName,
            harFile: auxVerifHarFile,
          },
        ]),
        { extraBinds: [profilesBind] },
      );
      auxVerif = {
        connectResult: auxVerifConnectResult,
        harFile: auxVerifHarFile,
      };
    });
    assert(aux!);
    assert(pre!);
    assert(taint!);

    return <StatefulTrackingAnalysisResult>{
      aux,
      pre,
      taint,
      verif,
      auxVerif,
    };
  });
}

export async function runSimulateConnect(
  site: string,
  options: {
    userDataDir: string;
    outputName: string;
    harFile?: string;
    taintFile?: string;
    screenshotFile?: string;
  },
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
        let rawReports: string[] | undefined;
        if (taintPath) {
          rawReports = [];
          await installFoxhoundTaintReporter(browser, {
            onReport(rawReport) {
              rawReports!.push(rawReport);
            },
          });
        }
        try {
          const result = await simulateConnect(browser, {
            site,
            screenshotPath,
          });
          return result;
        } finally {
          if (taintPath) {
            new FoxhoundTaintArchive(taintPath).insertRawReports(rawReports!);
          }
        }
      },
    ),
  );
}
