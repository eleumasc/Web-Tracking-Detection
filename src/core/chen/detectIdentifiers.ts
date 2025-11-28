import significantlyDifferent from "./significantlyDifferent";
import { joinStorageItemsById, StorageItem } from "../StorageItem";

// Heuristics-based Identifier Detection à la Cookie Swap Party
export default function detectIdentifiers(
  storageItemsA: StorageItem[],
  storageItemsB: StorageItem[]
): StorageItem[] {
  const MAX_STRING_LENGTH = 16 * 1024;

  return joinStorageItemsById(storageItemsA, storageItemsB)
    .filter(
      ([{ value: aValue }, { value: bValue }]) =>
        aValue.length >= 8 &&
        aValue.length <= MAX_STRING_LENGTH &&
        significantlyDifferent(aValue, bValue)
    )
    .map(([a]) => a);
}
