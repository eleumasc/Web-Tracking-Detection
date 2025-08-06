import { Completion } from "../util/Completion";
import { Credential } from "./credential/Credential";
import { SimulateLoginResult } from "./simulateLogin";
import { StorageState } from "./StorageState";
import { TaintReport } from "../foxhound/types";

export type AnalysisLogEntry = Completion<LTAResult[]>;

export type LTAResult = {
  loginPageCandidate: string;
  credential: Credential;
  loginCompletion: Completion<SimulateLoginResult>;
  taintReports?: TaintReport[];
  storageState?: StorageState;
};
