export interface TaintReport extends TaintReportWithoutTaint {
  taint: Taint;
}

export interface TaintReportWithoutTaint {
  loc: string;
  parentloc: string;
  referrer: string;
  sink: string;
  str: string;
  subframe: boolean;
  stack: any;
  timestamp: number;
}

export type Taint = TaintRange[];

export interface TaintRange {
  begin: number;
  end: number;
  flow: TaintOperation[];
}

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
