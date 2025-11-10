import significantlyDifferent from "./significantlyDifferent";
import { StorageState } from "../StorageState";

export type StorageKey =
  | {
      storageType: "cookie";
      name: string;
      domain: string;
      path: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: string;
    }
  | {
      storageType: "localStorage";
      name: string;
      origin: string;
    };

export type StorageItem = {
  key: StorageKey;
  value: string;
};

// Heuristics-based Identifier Matching à la Cookie Swap Party
export default function matchIdentifiers(
  storageStateA: StorageState,
  storageStateB: StorageState
): StorageItem[] {
  const MAX_STRING_LENGTH = 16 * 1024;

  return joinStorageItemsByKey(
    convertStorageStateIntoStorageItems(storageStateA),
    convertStorageStateIntoStorageItems(storageStateB)
  )
    .filter(
      ([{ value: aValue }, { value: bValue }]) =>
        aValue.length >= 8 &&
        aValue.length <= MAX_STRING_LENGTH &&
        significantlyDifferent(aValue, bValue)
    )
    .map(([a]) => a);
}

function convertStorageStateIntoStorageItems(
  storageState: StorageState
): StorageItem[] {
  const cookieItems: StorageItem[] = storageState.cookies.map(
    ({
      name,
      value,
      domain,
      path,
      httpOnly,
      secure,
      sameSite,
    }): StorageItem => ({
      key: {
        storageType: "cookie",
        name,
        domain,
        path,
        httpOnly,
        secure,
        sameSite,
      },
      value,
    })
  );

  const localStorageItems: StorageItem[] = storageState.origins.flatMap(
    ({ origin, localStorage }) =>
      localStorage.map(
        ({ name, value }): StorageItem => ({
          key: {
            storageType: "localStorage",
            name,
            origin,
          },
          value,
        })
      )
  );

  return [...cookieItems, ...localStorageItems];
}

function joinStorageItemsByKey(
  storageItemsA: StorageItem[],
  storageItemsB: StorageItem[]
): [StorageItem, StorageItem][] {
  const storageItemsAKeyMap = new Map(
    storageItemsA.map((a) => [JSON.stringify(a.key), a])
  );
  return storageItemsB.flatMap((b) => {
    const a = storageItemsAKeyMap.get(JSON.stringify(b.key));
    return a ? [[a, b]] : [];
  });
}
