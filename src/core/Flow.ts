import { Range } from "../util/Range";
import { RequestParameterKey } from "./RequestItem";
import { StorageItem } from "./StorageItem";
import { Token } from "./syntacticMatching/Token";

export type Flow = {
  storageItem: StorageItem;
  requestUrl: string;
};

export type TaintFlow = Flow & {
  storageValue: string;
  storageMatch: string;
  storageRange: Range;
  requestValue: string;
  requestMatch: string;
  requestRange: Range;
};

export type SyntacticFlow = Flow & {
  matches: SyntacticMatch[];
};

export type SyntacticMatch = {
  storageToken: Token;
  requestToken: Token;
  requestParamKey: RequestParameterKey;
};
