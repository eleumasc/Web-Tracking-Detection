import assert from "assert";
import execContainer from "../worker/execContainer";
import FoxTaintArchive from "../foxhound/FoxTaintArchive";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import path from "path";
import simulateConnect, { SimulateConnectResult } from "./simulateConnect";
import useFoxhound from "../foxhound/useFoxhound";
import useTempPath from "../util/useTempPath";
import { Analysis, StatefulTrackingAnalysis } from "./Analysis";
import { AnalysisLogEntry } from "./AnalysisLogEntry";
import { bomb } from "../util/timeout";
import { computeUnverifiedTrackingRequests } from "./computeUnverifiedTrackingRequests";
import { cpSync } from "fs";
import { createOutputDir, writeOutputFileSync } from "../data/outputDir";
import { makeTaskFromFunction } from "../worker/Task";
import { patchFoxhoundProfileStorage } from "../foxhound/patchFoxhoundProfileStorage";
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
  const taintRequestsFile = `${site}+T.json`;
  const syntacticRequestsFile = `${site}+S.json`;
  const modifiedStorageItemsFile = `${site}+C.json`;
  const auxVerifHarFile = `${site}+auxVerif.har.zip`;

  return toCompletion(async () => {
    let staResult: StatefulTrackingAnalysisResult;

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
      const aux: StatefulTrackingAnalysisResult["aux"] = {
        connectResult: auxConnectResult,
      };

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
      const pre: StatefulTrackingAnalysisResult["pre"] = {
        connectResult: preConnectResult,
      };

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
      const taint: StatefulTrackingAnalysisResult["taint"] = {
        connectResult: taintConnectResult,
        harFile: taintHarFile,
        taintFile: taintTaintFile,
      };

      staResult = { aux, pre, taint };

      if (options.analysis.noVerif) return;

      const { taintRequests, syntacticRequests, modifiedStorageItems } =
        computeUnverifiedTrackingRequests({
          analysisName: outputName,
          staResult,
        });
      writeOutputFileSync(
        path.join(outputName, taintRequestsFile),
        JSON.stringify(taintRequests),
      );
      writeOutputFileSync(
        path.join(outputName, syntacticRequestsFile),
        JSON.stringify(syntacticRequests),
      );
      writeOutputFileSync(
        path.join(outputName, modifiedStorageItemsFile),
        JSON.stringify(modifiedStorageItems),
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
      const verif: StatefulTrackingAnalysisResult["verif"] = {
        connectResult: verifConnectResult,
        harFile: verifHarFile,
        taintRequestsFile,
        syntacticRequestsFile,
        modifiedStorageItemsFile,
      };

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
      const auxVerif: StatefulTrackingAnalysisResult["auxVerif"] = {
        connectResult: auxVerifConnectResult,
        harFile: auxVerifHarFile,
      };

      staResult = { ...staResult, verif, auxVerif };
    });

    assert(staResult!);
    return staResult;
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
        let rawReports: any[] | undefined;
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
            new FoxTaintArchive(taintPath).insertRawReports(rawReports!);
          }
        }
      },
    ),
  );
}
