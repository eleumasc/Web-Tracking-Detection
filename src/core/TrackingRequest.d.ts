import { Request } from "./Request";

export interface TrackingRequest extends Request {
  tracker: string;
  taint: boolean;
  syntactic: boolean;
  confirmedSyntactic: boolean;
  refutedSyntactic: boolean;
  unknownSyntactic: boolean;
  noMatchingRequestsSyntactic: boolean;
  manyMatchingRequestsSyntactic: boolean;
}
