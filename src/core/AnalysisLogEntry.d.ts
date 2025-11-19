import { Completion } from "../util/Completion";
import { FoxhoundReport } from "../foxhound/types";
import { SimulateConnectResult } from "./simulateConnect";
import { StorageItem } from "./StorageItem";
import { StorageState } from "./StorageState";

export type AnalysisLogEntry = Completion<CTAResult>;

export type CTAResult = {
  aux: {
    connectResult: SimulateConnectResult;
  };
  pre: {
    connectResult: SimulateConnectResult;
  };
  taint: {
    connectResult: SimulateConnectResult;
    harFile: string;
    taintFile: string;
  };
  verif: {
    alteredStorageItems: StorageItem[];
    connectResult: SimulateConnectResult;
    harFile: string;
    taintFile: string;
  };
};
