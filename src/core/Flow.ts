import { Range } from "../util/Range";
import { RequestParameterKey } from "./RequestItem";
import { StorageItem } from "./StorageItem";
import { Token } from "./syntacticMatching/Token";

export interface Flow {
  storageItem: StorageItem;
  requestUrl: string;
}

export interface TaintFlow extends Flow {
  storageValue: string;
  storageMatch: string;
  storageRange: Range;
  requestValue: string;
  requestMatch: string;
  requestRange: Range;
}

export interface SyntacticFlow extends Flow {
  matches: SyntacticMatch[];
}

export interface SyntacticMatch {
  storageToken: Token;
  requestToken: Token;
  requestParamKey: RequestParameterKey;
}
