import { SimulateConnectResult } from "./simulateConnect";

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
    connectResult: SimulateConnectResult;
    harFile: string;
    taintFlowsFile: string;
    syntacticFlowsFile: string;
    storageCanariesFile: string;
  };
  auxVerif?: {
    connectResult: SimulateConnectResult;
    harFile: string;
  };
}
