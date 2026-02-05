export interface FoxReport {
  subframe: boolean;
  loc: string;
  baseURI: string;
  sinkOperation: FoxOperation;
  str: string;
  taint: FoxTaint;
  stack: any;
}

export type FoxTaint = FoxRange[];

export interface FoxRange {
  begin: number;
  end: number;
  flow: FoxOperation[];
}

export interface FoxOperation {
  arguments: string[];
  builtin: boolean;
  location: FoxLocation;
  operation: string;
  source: boolean;
}

export interface FoxLocation {
  filename: string;
  function: string;
  line: number;
  pos: number;
  scripthash: string;
  scriptline: number;
}
