import { StorageState } from "./StorageState";

export type StorageItem = {
  key: StorageKey;
  value: string;
};

export type StorageKey =
  | {
      itemId: string;
      storageType: "cookie";
      name: string;
      domain: string;
      path: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: string;
    }
  | {
      itemId: string;
      storageType: "localStorage";
      name: string;
      origin: string;
    };

export function getStorageItemsFromStorageState(
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
        itemId: `cookie:${name}`,
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
            itemId: `localStorage:${name}`,
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
