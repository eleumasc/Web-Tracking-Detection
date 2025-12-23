import { OperationToken } from "./syntacticMatching/Token";
import { StorageItem } from "./StorageItem";

export type AbstractFlow = {
  storageItem: StorageItem;
  requestUrl: string;
  matches: AbstractMatch[];
};

export type AbstractMatch = {
  storageToken: OperationToken;
  requestToken: OperationToken;
};
