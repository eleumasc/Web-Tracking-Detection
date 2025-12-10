import _ from "lodash";
import alterTransformTree from "./alterTransformTree";
import { StorageTransformTreeEntry } from "./getSyntacticAbstractFlows";

export default function alterStorageTransformTreeEntries(
  storageTransformTreeEntries: StorageTransformTreeEntry[]
): StorageTransformTreeEntry[] {
  return storageTransformTreeEntries.map(
    ({ storageItem, transformTree }): StorageTransformTreeEntry => {
      const alteredTransformTree = alterTransformTree(transformTree);
      return {
        storageItem: {
          ...storageItem,
          value: alteredTransformTree.token.value,
        },
        transformTree: alteredTransformTree,
      };
    }
  );
}
