import { OperationToken } from "./Token";
import { StorageItem } from "./StorageItem";

export type Flow = {
  storageItem: StorageItem;
  requestUrl: string;
  matches: Match[];
};

export type Match = {
  storageToken: OperationToken;
  requestToken: OperationToken;
  requestParameter: RequestParameter;
};

export type RequestParameter =
  | { type: "unknown" }
  | {
      type: "urlPathSegment";
      segmentIndex: number;
    }
  | {
      type: "urlQueryParam";
      paramKey: string;
    }
  | {
      type: "postData";
    };
