import { OperationToken } from "./Token";
import { StorageItem } from "./StorageItem";

export type Flow = {
  storageItem: StorageItem;
  requestUrl: string;
  matches: FlowMatch[];
};

export type FlowMatch = {
  storageToken: OperationToken;
  requestToken: OperationToken;
};
