import _ from "lodash";
import assert from "assert";

export interface BaseAnalysis {
  type: string;
}

export interface StatefulTrackingAnalysis {
  type: "StatefulTracking";
  noVerif: boolean;
}

export type Analysis = StatefulTrackingAnalysis;

export function createStatefulTrackingAnalysis(args: {
  noVerif?: boolean;
}): Analysis {
  return {
    type: "StatefulTracking",
    noVerif: args.noVerif ?? false,
  };
}
