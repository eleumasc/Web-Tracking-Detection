import { Completion } from "../util/Completion";
import { SimulateConnectResult } from "./simulateConnect";
import { StorageState } from "./StorageState";
import { TaintReport } from "../foxhound/types";

export type AnalysisLogEntry = Completion<CTAResult>;

export type CTAResult = {
  connectResult: SimulateConnectResult;
  taintReports: TaintReport[];
  storageState: StorageState;
  harFile: string;
};
