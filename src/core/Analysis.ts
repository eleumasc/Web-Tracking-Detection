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

export function parseAnalysis(desc: string): Analysis {
  const data = JSON.parse(desc);
  assert(typeof data === "object" && data !== null);

  const { type } = data;
  assert(typeof type === "string");

  switch (type) {
    case "StatefulTracking":
    case "IdDetection":
      break;
    default:
      assert(false, `Unknown type of Analysis: ${type}`);
  }

  return data;
}
