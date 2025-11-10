import { Completion } from "../util/Completion";
import { SimulateConnectResult } from "./simulateConnect";
import { StorageState } from "./StorageState";
import { TaintReport } from "../foxhound/types";

export type AnalysisLogEntry = Completion<CTAResult>;

export type CTAResult = {
  firstConnectResult: SimulateConnectResult;
  preConnectResult: SimulateConnectResult;
  taintConnectResult: SimulateConnectResult;
  firstStorageState: StorageState;
  preStorageState: StorageState;
  taintReports: TaintReport[];
  harFile: string;
};
