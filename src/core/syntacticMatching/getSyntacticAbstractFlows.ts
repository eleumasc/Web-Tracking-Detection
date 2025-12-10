import assert from "assert";
import { AbstractFlow } from "../AbstractFlow";
import { createSyntacticMatcher, SyntacticMatcher } from "./syntacticMatcher";
import { getRequestEntriesFromHar } from "./RequestEntry";
import { HarController } from "../../util/HarController";
import { mergeTransformTrees, TransformTree } from "./TransformTree";
import { StorageItem } from "../StorageItem";

export type StorageTransformTreeEntry = {
  storageItem: StorageItem;
  transformTree: TransformTree;
};

export function getSyntacticAbstractFlows(
  storageItems: StorageItem[],
  harController: HarController
): {
  abstractFlows: AbstractFlow[];
  storageTransformTreeEntries: StorageTransformTreeEntry[];
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

  const requestEntries = getRequestEntriesFromHar(harController);

  const abstractFlows: AbstractFlow[] = [];
  for (const storageEntry of storageEntries) {
    const { storageItem, matcher } = storageEntry;
    for (const requestEntry of requestEntries) {
      const { value: requestValue, receiverOrigin } = requestEntry;
      const { matches, transformTree } = matcher(requestValue);
      if (matches.length > 0) {
        abstractFlows.push({
          storageItem,
          receiverOrigin,
          matches,
        });
        assert(transformTree);
        storageEntry.transformTree = storageEntry.transformTree
          ? mergeTransformTrees(storageEntry.transformTree, transformTree)
          : transformTree;
      }
    }
  }
  const storageTransformTreeEntries = storageEntries.flatMap(
    ({ storageItem, transformTree }) =>
      transformTree ? [{ storageItem, transformTree }] : []
  );
  return { abstractFlows, storageTransformTreeEntries };
}
