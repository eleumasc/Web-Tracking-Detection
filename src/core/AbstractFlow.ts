import { OperationToken } from "./syntacticMatching/Token";
import { StorageItem } from "./StorageItem";

export type AbstractFlow = {
  storageItem: StorageItem;
  receiverOrigin: string;
  matches: AbstractMatch[];
};

export type AbstractMatch = {
  storageToken: OperationToken;
  requestToken: OperationToken;
};

export function originFromUrl(url: URL | string): string {
  return new URL(url).origin;
}
