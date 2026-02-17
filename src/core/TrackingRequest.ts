import _ from "lodash";
import { Request } from "./Request";

export interface TrackingRequest extends Request {
  tracker: string;
  taint: boolean;
  syntactic: boolean;
  confirmedTaint: boolean;
  unknownTaint: boolean;
  confirmedSyntactic: boolean;
  refutedSyntactic: boolean;
  unknownSyntactic: boolean;
  noMatchingRequestsSyntactic: boolean;
  manyMatchingRequestsSyntactic: boolean;
}

export interface TrackingSiteEntry {
  site: string;
  trackingRequests: TrackingRequest[];
}

export function siteTrackers(entry: TrackingSiteEntry): string[] {
  const { trackingRequests: requests } = entry;
  return _.uniq(requests.map((request) => request.tracker));
}
