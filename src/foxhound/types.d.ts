export interface TaintReport {
  subframe: boolean;
  loc: string;
  baseURI: string;
  sink: TaintOperation;
  str: string;
  taint: Taint;
  stack: any;
  timestamp: any; // It should be a number, but Date.now() may have been monkey-patched at analysis time. In such a case, the function may have returned a non-number value (e.g., see cornell.edu).
}

export type Taint = TaintRange[];

export interface TaintRange {
  begin: number;
  end: number;
  flow: TaintFlow;
}

export type TaintFlow = TaintOperation;

export interface TaintOperation {
  arguments: string[];
  builtin: boolean;
  location: TaintLocation;
  operation: string;
  source: boolean;
}

export interface TaintLocation {
  filename: string;
  function: string;
  line: number;
  pos: number;
  scripthash: string;
  scriptline: number;
}
