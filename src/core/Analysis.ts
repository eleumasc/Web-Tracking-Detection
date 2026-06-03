export interface BaseAnalysis {
  type: string;
}

export interface StatefulTrackingAnalysis extends BaseAnalysis {
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
