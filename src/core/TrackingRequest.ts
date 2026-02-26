import _ from "lodash";
import { Request } from "./Request";
import { RequestParam } from "./RequestParam";

export interface TrackingRequest extends Request {
  tracker: string;
  taint: boolean;
  syntactic: boolean;
  taintVerifLabel?: TaintVerifLabel;
  syntacticVerifLabel?: SyntacticVerifLabel;
  syntacticHoles?: RequestParam[];
}

export const TaintVerifLabel = {
  CONFIRMED: "CONFIRMED",
  UNKNOWN: "UNKNOWN",
} as const;

export type TaintVerifLabel =
  (typeof TaintVerifLabel)[keyof typeof TaintVerifLabel];

export const SyntacticVerifLabel = {
  CONFIRMED: "CONFIRMED",
  REFUTED: "REFUTED",
  UNKNOWN: "UNKNOWN",
  NO_MATCHING_REQUESTS: "NO_MATCHING_REQUESTS",
} as const;

export type SyntacticVerifLabel =
  (typeof SyntacticVerifLabel)[keyof typeof SyntacticVerifLabel];

export interface TrackingSiteEntry {
  site: string;
  trackingRequests: TrackingRequest[];
}

export function siteTrackers(entry: TrackingSiteEntry): string[] {
  const { trackingRequests: requests } = entry;
  return _.uniq(requests.map((request) => request.tracker));
}
