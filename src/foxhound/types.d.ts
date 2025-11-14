export interface FoxhoundReport {
  subframe: boolean;
  loc: string;
  baseURI: string;
  sink: FoxhoundOperation;
  str: string;
  taint: FoxhoundTaint;
  stack: any;
  timestamp: any; // It should be a number, but Date.now() may have been monkey-patched at analysis time. In such a case, the function may have returned a non-number value (e.g., see cornell.edu).
}

export type FoxhoundTaint = FoxhoundRange[];

export interface FoxhoundRange {
  begin: number;
  end: number;
  flow: FoxhoundFlow;
}

export type FoxhoundFlow = FoxhoundOperation;

export interface FoxhoundOperation {
  arguments: string[];
  builtin: boolean;
  location: FoxhoundLocation;
  operation: string;
  source: boolean;
}

export interface FoxhoundLocation {
  filename: string;
  function: string;
  line: number;
  pos: number;
  scripthash: string;
  scriptline: number;
}
