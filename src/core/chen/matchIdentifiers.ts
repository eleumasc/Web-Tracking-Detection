import significantlyDifferent from "./significantlyDifferent";
import { StorageItem } from "../StorageItem";

// Heuristics-based Identifier Matching à la Cookie Swap Party
export default function matchIdentifiers(
  storageItemsA: StorageItem[],
  storageItemsB: StorageItem[]
): StorageItem[] {
  const MAX_STRING_LENGTH = 16 * 1024;

  return joinStorageItemsByKey(storageItemsA, storageItemsB)
    .filter(
      ([{ value: aValue }, { value: bValue }]) =>
        aValue.length >= 8 &&
        aValue.length <= MAX_STRING_LENGTH &&
        significantlyDifferent(aValue, bValue)
    )
    .map(([a]) => a);
}

function joinStorageItemsByKey(
  storageItemsA: StorageItem[],
  storageItemsB: StorageItem[]
): [StorageItem, StorageItem][] {
  const storageItemsAKeyMap = new Map(
    storageItemsA.map((a) => [JSON.stringify(a.id), a])
  );
  return storageItemsB.flatMap((b) => {
    const a = storageItemsAKeyMap.get(JSON.stringify(b.id));
    return a ? [[a, b]] : [];
  });
}
