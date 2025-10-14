export interface TaintReport {
  subframe: boolean;
  loc: string;
  baseURI: string;
  sink: TaintOperation;
  str: string;
  taint: Taint;
  stack: any;
  timestamp: number;
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
