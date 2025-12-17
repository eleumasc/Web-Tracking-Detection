import _ from "lodash";
import alterTransformTree from "./alterTransformTree";
import { StorageCanariesEntry } from "./verifySyntacticAbstractFlows";
import { StorageTransformTreeEntry } from "./getSyntacticAbstractFlows";
import { TransformTree } from "./TransformTree";

export default function computeStorageCanariesEntries(
  transformTreeEntries: StorageTransformTreeEntry[]
): StorageCanariesEntry[] {
  const canariesEntries: StorageCanariesEntry[] = [];
  for (const { storageItem, transformTree: tree } of transformTreeEntries) {
    try {
      const alteredTree = alterTransformTree(tree, alteredTreePredicate);
      canariesEntries.push({
        storageItem: {
          ...storageItem,
          value: alteredTree.token.value,
        },
        canaries: extractCanaries(alteredTree),
      });
    } catch (e) {
      console.error(e);
      continue;
    }
  }
  return canariesEntries;

  function alteredTreePredicate(tree: TransformTree): boolean {
    const newCanaries = extractCanaries(tree);
    return canariesEntries.every(({ canaries }) =>
      canaries.every((canary) =>
        newCanaries.every(
          (newCanary) =>
            !canary.includes(newCanary) && !newCanary.includes(canary)
        )
      )
    );
  }
}

function extractCanaries(transformTree: TransformTree): string[] {
  return traverse(transformTree);

  function traverse(tree: TransformTree): string[] {
    if (tree.children.length === 0) {
      return [tree.token.value];
    }
    return _.uniq(tree.children.flatMap((child) => traverse(child)));
  }
}
