import _ from "lodash";
import { StorageState } from "./StorageState";

export type StorageItem = Cookie | LocalStorageItem;

export type Cookie = {
  id: {
    storageType: "cookie";
    key: string;
    domain: string;
    path: string;
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
        path,
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
