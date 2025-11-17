import { Completion } from "../util/Completion";
import { FoxhoundReport } from "../foxhound/types";
import { SimulateConnectResult } from "./simulateConnect";
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
    initialStorageState: StorageState;
    connectResult: SimulateConnectResult;
    harFile: string;
    taintFile: string;
  };
};
