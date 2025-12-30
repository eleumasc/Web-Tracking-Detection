import assert from "assert";
import { createSyntacticMatcher, SyntacticMatcher } from "./syntacticMatcher";
import { Flow } from "../Flow";
import { getRequestEntriesFromHar } from "./RequestEntry";
import { HarReader } from "../../util/HarReader";
import { mergeTransformTrees, TransformTree } from "./TransformTree";
import { StorageItem } from "../StorageItem";

export type StorageDerivationEntry = {
  storageItem: StorageItem;
  transformTree: TransformTree;
};

export function getSyntacticFlows(
  storageItems: StorageItem[],
  harReader: HarReader
): {
  flows: Flow[];
  storageDerivationEntries: StorageDerivationEntry[];
} {
  type StorageEntry = {
    storageItem: StorageItem;
    matcher: SyntacticMatcher;
    transformTree: TransformTree | null;
  };

  const storageEntries = storageItems.map(
    (storageItem): StorageEntry => ({
      storageItem,
      matcher: createSyntacticMatcher(storageItem.value),
      transformTree: null,
    })
  );

  const requestEntries = getRequestEntriesFromHar(harReader);

  const flows: Flow[] = [];
  for (const storageEntry of storageEntries) {
    const { storageItem, matcher } = storageEntry;
    for (const requestEntry of requestEntries) {
      const { value: requestValue, requestUrl } = requestEntry;
      const { matches, transformTree } = matcher(requestValue);
      if (matches.length > 0) {
        flows.push({
          storageItem,
          requestUrl,
          matches,
        });
        assert(transformTree);
        storageEntry.transformTree = storageEntry.transformTree
          ? mergeTransformTrees(storageEntry.transformTree, transformTree)
          : transformTree;
      }
    }
  }
  const storageDerivationEntries = storageEntries.flatMap(
    ({ storageItem, transformTree }) =>
      transformTree ? [{ storageItem, transformTree }] : []
  );
  return { flows, storageDerivationEntries };
}
