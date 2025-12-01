import assert from "assert";

export interface BaseAnalysis {
  type: string;
}

export interface StatefulTrackingAnalysis {
  type: "StatefulTracking";
}

export interface IdDetectionAnalysis extends BaseAnalysis {
  type: "IdDetection";
}

export type Analysis = StatefulTrackingAnalysis | IdDetectionAnalysis;

export function parseAnalysis(descriptor: string): Analysis {
  const match = descriptor.match(/([A-Za-z0-9]+)(?:\:(.*))?/);
  assert(match);
  const { 1: type, 2: argsData } = match;

  switch (type) {
    case "StatefulTracking":
    case "IdDetection":
      break;
    default:
      assert(false, `Unknown type of Analysis: ${type}`);
  }

  let args = null;
  if (argsData) {
    args = JSON.parse(argsData);
    assert(typeof args === "object" && args !== null);
  }

  return { type, ...args };
}
