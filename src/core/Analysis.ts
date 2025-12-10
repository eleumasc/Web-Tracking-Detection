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

export function parseAnalysis(descriptor: string): Analysis {
  const match = descriptor.match(/([A-Za-z0-9]+)(?:\:(.*))?/);
  assert(match);
  const { 1: type, 2: argsData } = match;

  switch (type) {
    case "StatefulTracking":
      break;
    default:
      assert(false, `Unknown type of Analysis: ${type}`);
  }

  let args = null;
  if (argsData) {
    args = JSON.parse(argsData);
    assert(typeof args === "object" && args !== null);
  }

  if (args) {
    switch (type) {
      case "StatefulTracking": {
        args = _.defaults(
          { ...args },
          {
            noVerif: false,
          }
        );
        assert(typeof args.noVerif === "boolean");
        break;
      }
    }
  }

  return { type, ...args };
}
