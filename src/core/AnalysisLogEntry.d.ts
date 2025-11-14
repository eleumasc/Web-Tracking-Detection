import { Completion } from "../util/Completion";
import { FoxhoundReport } from "../foxhound/types";
import { SimulateConnectResult } from "./simulateConnect";
import { StorageState } from "./StorageState";

export type AnalysisLogEntry = Completion<CTAResult>;

export type CTAResult = {
  firstConnectResult: SimulateConnectResult;
  preConnectResult: SimulateConnectResult;
  taintConnectResult: SimulateConnectResult;
  firstStorageState: StorageState;
  preStorageState: StorageState;
  taintReports: FoxhoundReport[];
  harFile: string;
};
