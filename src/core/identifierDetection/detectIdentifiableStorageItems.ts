import significantlyDifferent from "./significantlyDifferent";
import { isIdentifiable } from "./identifiable";
import { joinStorageItemsById, StorageItem } from "../StorageItem";

export default function detectIdentifiableStorageItems(
  thisStorageItems: StorageItem[],
  thatStorageItems: StorageItem[]
): StorageItem[] {
  const MAX_STRING_LENGTH = 16 * 1024;

  return joinStorageItemsById(thisStorageItems, thatStorageItems)
    .filter(
      ([{ value: aValue }, { value: bValue }]) =>
        aValue.length >= 8 &&
        aValue.length <= MAX_STRING_LENGTH &&
        significantlyDifferent(aValue, bValue)
    )
    .map(([a]) => a)
    .filter(({ value }) => isIdentifiable(value));
}
