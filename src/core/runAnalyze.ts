import assert from "assert";
import execContainer from "../worker/execContainer";
import FoxTaintArchive from "../foxhound/FoxTaintArchive";
import installFoxhoundTaintReporter from "../foxhound/installFoxhoundTaintReporter";
import path from "path";
import simulateConnect, { SimulateConnectResult } from "./simulateConnect";
import useFoxhound from "../foxhound/useFoxhound";
import useTempPath from "../data/temp";
import { Analysis, StatefulTrackingAnalysis } from "./Analysis";
import { AnalysisCompletion } from "./AnalysisCompletion";
import { bomb } from "../util/timeout";
import { computeUnverifiedTrackingRequests } from "./computeUnverifiedTrackingRequests";
import { cpSync, writeFileSync } from "fs";
import { makeDataPath } from "../data/path";
import { makeTaskFromFunction } from "../worker/Task";
import { patchFoxhoundProfileStorage } from "../foxhound/patchFoxhoundProfileStorage";
import { toCompletion } from "../util/Completion";
import {
  AnalysisResult,
  StatefulTrackingAnalysisResult,
} from "./AnalysisResult";

export type RunAnalyzeOptions<T extends Analysis> = {
  site: string;
  dataName: string;
  analysis: T;
};

export const ANALYSIS_TIMEOUT_MS: number = 5 * 60 * 1000; // 5 minutes

export async function runAnalyze<T extends Analysis>(options: {
  site: string;
  dataName: string;
  analysis: T;
}): Promise<AnalysisCompletion<AnalysisResult>> {
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
): Promise<AnalysisCompletion<StatefulTrackingAnalysisResult>> {
  const { site, dataName } = options;

  const taintHarFile = `${site}+taint.har.zip`;
  const taintTaintFile = `${site}+taint.taint.sqlite`;
  const verifHarFile = `${site}+verif.har.zip`;
  const taintRequestsFile = `${site}+T.json`;
  const syntacticRequestsFile = `${site}+S.json`;
  const canaryStorageItemsFile = `${site}+C.json`;
  const auxVerifHarFile = `${site}+auxVerif.har.zip`;

  return toCompletion(async () => {
    let staResult: StatefulTrackingAnalysisResult;

    await useTempPath(async (profilesDir, profilesHostDir) => {
      const profilesWorkerDir = "/profiles";
      const profilesBind = `${profilesHostDir}:${profilesWorkerDir}`;

      const auxConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(profilesWorkerDir, "aux"),
            dataName,
          },
        ]),
        { extraBinds: [profilesBind] }
      );
      const aux: StatefulTrackingAnalysisResult["aux"] = {
        connectResult: auxConnectResult,
      };

      const preConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(profilesWorkerDir, "taint"),
            dataName,
          },
        ]),
        { extraBinds: [profilesBind] }
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
            userDataDir: path.join(profilesWorkerDir, "taint"),
            dataName,
            harFile: taintHarFile,
            taintFile: taintTaintFile,
            screenshotFile: `${site}.png`,
          },
        ]),
        { extraBinds: [profilesBind] }
      );
      const taint: StatefulTrackingAnalysisResult["taint"] = {
        connectResult: taintConnectResult,
        harFile: taintHarFile,
        taintFile: taintTaintFile,
      };

      staResult = { aux, pre, taint };

      if (options.analysis.noVerif) return;

      const { taintRequests, syntacticRequests, canaryStorageItems } =
        computeUnverifiedTrackingRequests({
          analyzeDataName: dataName,
          staResult,
        });
      writeFileSync(
        makeDataPath(dataName, taintRequestsFile),
        JSON.stringify(taintRequests)
      );
      writeFileSync(
        makeDataPath(dataName, syntacticRequestsFile),
        JSON.stringify(syntacticRequests)
      );
      writeFileSync(
        makeDataPath(dataName, canaryStorageItemsFile),
        JSON.stringify(canaryStorageItems)
      );

      patchFoxhoundProfileStorage(
        path.join(profilesDir, "verif"),
        canaryStorageItems.map(({ storageItem }) => storageItem)
      );
      const verifConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(profilesWorkerDir, "verif"),
            dataName,
            harFile: verifHarFile,
          },
        ]),
        { extraBinds: [profilesBind] }
      );
      const verif: StatefulTrackingAnalysisResult["verif"] = {
        connectResult: verifConnectResult,
        harFile: verifHarFile,
        taintRequestsFile,
        syntacticRequestsFile,
        canaryStorageItemsFile,
      };

      patchFoxhoundProfileStorage(
        path.join(profilesDir, "aux"),
        canaryStorageItems.map(({ storageItem }) => storageItem)
      );
      const auxVerifConnectResult: SimulateConnectResult = await execContainer(
        makeTaskFromFunction(runSimulateConnect, [
          site,
          {
            userDataDir: path.join(profilesWorkerDir, "aux"),
            dataName,
            harFile: auxVerifHarFile,
          },
        ]),
        { extraBinds: [profilesBind] }
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
    dataName: string;
    harFile?: string;
    taintFile?: string;
    screenshotFile?: string;
  }
) {
  const { userDataDir, dataName, harFile, taintFile, screenshotFile } = options;

  const harPath = harFile && makeDataPath(dataName, harFile);
  const taintPath = taintFile && makeDataPath(dataName, taintFile);
  const screenshotPath =
    screenshotFile && makeDataPath(dataName, screenshotFile);

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
            FoxTaintArchive.open(taintPath).addRawReports(rawReports!);
          }
        }
      }
    )
  );
}
