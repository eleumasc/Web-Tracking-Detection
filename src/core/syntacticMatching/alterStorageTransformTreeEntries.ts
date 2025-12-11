import _ from "lodash";
import alterTransformTree from "./alterTransformTree";
import { StorageTransformTreeEntry } from "./getSyntacticAbstractFlows";

export default function alterStorageTransformTreeEntries(
  storageTransformTreeEntries: StorageTransformTreeEntry[]
): StorageTransformTreeEntry[] {
  return storageTransformTreeEntries.flatMap(
    ({ storageItem, transformTree }): StorageTransformTreeEntry[] => {
      try {
        const alteredTransformTree = alterTransformTree(transformTree);
        return [
          {
            storageItem: {
              ...storageItem,
              value: alteredTransformTree.token.value,
            },
            transformTree: alteredTransformTree,
          },
        ];
      } catch (e) {
        console.error(e);
        return [];
      }
    }
  );
}
