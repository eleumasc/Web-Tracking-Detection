import { findRequestId, Har } from "../../util/Har";
import { parseRequestParamEntries, RequestParam } from "../RequestParam";
import { Request } from "../Request";
import { StorageItem } from "../StorageItem";
import { syntacticMatcher } from "./syntacticMatcher";
import { Token } from "./Token";
import { TransformTree } from "./TransformTree";
import {
  parseRequestValueRootNode,
  transformStorageValueRootNode,
} from "./rootNodes";

export interface SyntacticRequest extends Request {
  storageMatches: StorageMatch[];
}

export interface StorageMatch {
  storageItem: StorageItem;
  syntacticMatches: SyntacticMatch[];
}

export interface SyntacticMatch {
  storageToken: Token;
  requestToken: Token;
  requestParam: RequestParam;
}

export function computeSyntacticRequests(
  storageItems: StorageItem[],
  har: Har,
  includeIfNoStorageMatches?: boolean,
): SyntacticRequest[] {
  const storageEntries = storageItems.map((storageItem) => ({
    storageItem,
    transformTree: new TransformTree(
      transformStorageValueRootNode(),
      storageItem.value,
    ),
  }));

  const syntacticRequests: SyntacticRequest[] = [];
  for (const harEntry of har.entries()) {
    const requestId = findRequestId(harEntry);
    if (!requestId) continue;

    const { request } = harEntry;
    const { url: requestUrl } = request;

    const requestEntries = parseRequestParamEntries(harEntry, har).map(
      (paramEntry) => ({
        paramEntry,
        transformTree: new TransformTree(
          parseRequestValueRootNode(),
          paramEntry.value,
        ),
      }),
    );

    const storageMatches: StorageMatch[] = [];
    for (const {
      storageItem,
      transformTree: storageTransformTree,
    } of storageEntries) {
      for (const {
        paramEntry: { param },
        transformTree: requestTransformTree,
      } of requestEntries) {
        const syntacticMatches = syntacticMatcher(
          storageTransformTree,
          requestTransformTree,
        ).map(
          (syntacticMatch): SyntacticMatch => ({
            ...syntacticMatch,
            requestParam: param,
          }),
        );

        if (syntacticMatches.length > 0) {
          storageMatches.push({ storageItem, syntacticMatches });
        }
      }
    }

    if (storageMatches.length > 0 || includeIfNoStorageMatches) {
      syntacticRequests.push({
        requestId,
        url: requestUrl,
        storageMatches,
      });
    }
  }

  return syntacticRequests;
}
