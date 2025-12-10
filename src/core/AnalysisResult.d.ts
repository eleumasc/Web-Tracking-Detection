import { FoxhoundReport } from "../foxhound/types";
import { SimulateConnectResult } from "./simulateConnect";
import { StorageCanariesEntry } from "./syntacticMatching/verifySyntacticAbstractFlows";
import { StorageItem } from "./StorageItem";
import { StorageState } from "./StorageState";

export interface AnalysisResult {}

export interface StatefulTrackingAnalysisResult extends AnalysisResult {
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
  verif?: {
    storageCanariesFile: string;
    connectResult: SimulateConnectResult;
    harFile: string;
    taintFile: string;
    taintFlowsFile: string;
    syntacticFlowsFile: string;
  };
}
