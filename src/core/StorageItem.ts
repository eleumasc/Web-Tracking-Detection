import _ from "lodash";
import { StorageState } from "./StorageState";

export type StorageItem = Cookie | LocalStorageItem;

export type Cookie = {
  id: {
    storageType: "cookie";
    key: string;
    domain: string;
  };
  value: string;
};

export type LocalStorageItem = {
  id: {
    storageType: "localStorage";
    key: string;
    origin: string;
  };
  value: string;
};

export function getStorageItemsFromStorageState(
  storageState: StorageState
): StorageItem[] {
  const cookieItems: StorageItem[] = storageState.cookies.map(
    ({ name: key, value, domain, path }): StorageItem => ({
      id: {
        storageType: "cookie",
        key,
        domain,
      },
      value,
    })
  );

  const localStorageItems: StorageItem[] = storageState.origins.flatMap(
    ({ origin, localStorage }) =>
      localStorage.map(
        ({ name: key, value }): StorageItem => ({
          id: {
            storageType: "localStorage",
            key,
            origin,
          },
          value,
        })
      )
  );

  return [...cookieItems, ...localStorageItems];
}

export function joinStorageItemsById(
  storageItemsA: StorageItem[],
  storageItemsB: StorageItem[]
): [StorageItem, StorageItem][] {
  const storageItemsBKeyMap = new Map(
    storageItemsB.map((b) => [JSON.stringify(b.id), b])
  );
  return storageItemsA.flatMap((a) => {
    const b = storageItemsBKeyMap.get(JSON.stringify(a.id));
    return b ? [[a, b]] : [];
  });
}
