import { getRequestsFromHar } from "./Request";
import { Har } from "../../util/Har";
import { memoize } from "../../util/memoize";
import { StorageItem } from "../StorageItem";
import { SyntacticFlow, SyntacticMatch } from "../Flow";
import { syntacticMatcher } from "./syntacticMatcher";
import { TransformTree } from "./TransformTree";
import {
  parseRequestValueRootNode,
  transformStorageValueRootNode,
} from "./rootNodes";

export function getSyntacticFlows(
  storageItems: StorageItem[],
  har: Har,
): SyntacticFlow[] {
  const getStorageTransformTree = memoize(
    (storageValue) =>
      new TransformTree(transformStorageValueRootNode(), storageValue),
  );
  const storageEntries = storageItems.map((storageItem) => ({
    storageItem,
    transformTree: getStorageTransformTree(storageItem.value),
  }));

  const getRequestTransformTree = memoize(
    (requestValue) =>
      new TransformTree(parseRequestValueRootNode(), requestValue),
  );
  const requests = getRequestsFromHar(har).map(
    ({ url: requestUrl, paramEntries }) => ({
      requestUrl,
      paramEntries: paramEntries.map(({ param, value }) => ({
        param,
        transformTree: getRequestTransformTree(value),
      })),
    }),
  );

  const syntacticFlows: SyntacticFlow[] = [];
  for (const {
    storageItem,
    transformTree: storageTransformTree,
  } of storageEntries) {
    for (const { requestUrl, paramEntries } of requests) {
      const matches: SyntacticMatch[] = paramEntries.flatMap(
        ({ param, transformTree: requestTransformTree }) =>
          syntacticMatcher(storageTransformTree, requestTransformTree).map(
            (syntacticMatch): SyntacticMatch => ({
              ...syntacticMatch,
              requestParam: param,
            }),
          ),
      );
      if (matches.length > 0) {
        syntacticFlows.push({
          storageItem,
          requestUrl,
          matches,
        });
      }
    }
  }

  return syntacticFlows;
}
