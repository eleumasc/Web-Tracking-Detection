import _ from "lodash";
import assert from "assert";
import { clusterObjectsBy } from "../../util/cluster";
import { Cookie, StorageItem } from "../StorageItem";
import { FoxRange, FoxReport } from "../../foxhound/types";
import { FoxURL } from "./FoxURL";
import { range, toArray } from "iter-tools";
import { tryParseStorageCharFlow } from "./StorageCharFlow";

export interface StorageFlow {
  storageItem: StorageItem;
  links: [number, number][]; // 1st: requestIndex, 2nd: storageIndex
  intermeds: string[];
}

export interface UncheckedStorageFlow {
  origin: string;
  storageType: string;
  key: string;
  value: string;
  links: [number, number][];
  intermeds: string[];
}

export function getUncheckedStorageFlows(
  foxTaint: FoxRange[],
  foxReport: FoxReport,
  isUrlArgType: boolean = false,
): UncheckedStorageFlow[] {
  const origin = new URL(foxReport.loc).origin;
  const foxUrl = new FoxURL(foxReport.str, foxReport.baseURI);
  return clusterObjectsBy(
    foxTaint.flatMap((foxRange) => {
      const storageCharFlow = tryParseStorageCharFlow(foxRange);
      return storageCharFlow ? [storageCharFlow] : [];
    }),
    ({ storageType, key, value }) => [storageType, key, value],
  )
    .map((cluster): UncheckedStorageFlow => {
      const { storageType, key, value } = cluster[0];
      let links = cluster.flatMap(({ begin, end, storageIndex }) =>
        toArray(range(begin, end)) //
          .map((requestIndex): [number, number] => [
            requestIndex,
            storageIndex,
          ]),
      );
      if (isUrlArgType) {
        links = links
          .map(([requestIndex, storageIndex]): [number, number] =>
            //
            [requestIndex + foxUrl.inputRange.begin, storageIndex],
          )
          .filter(
            ([requestIndex]) =>
              requestIndex >= foxUrl.taintableRange.begin &&
              requestIndex < foxUrl.taintableRange.end,
          );
      }
      const intermeds = _.uniq(cluster.flatMap(({ intermeds }) => intermeds));
      return { origin, storageType, key, value, links, intermeds };
    })
    .filter(({ links }) => links.length > 0);
}

export function tryCheckStorageFlowArray(
  uncheckedArray: UncheckedStorageFlow[],
  storageItems: StorageItem[],
): StorageFlow[] | undefined {
  const checkedArray = uncheckedArray.flatMap((unchecked) => {
    const checked = tryCheckStorageFlow(unchecked, storageItems);
    return checked ? [checked] : [];
  });
  return checkedArray.length > 0 ? checkedArray : undefined;
}

export function tryCheckStorageFlow(
  unchecked: UncheckedStorageFlow,
  storageItems: StorageItem[],
): StorageFlow | undefined {
  try {
    return checkStorageFlow(unchecked, storageItems);
  } catch {
    return;
  }
}

export function checkStorageFlow(
  unchecked: UncheckedStorageFlow,
  storageItems: StorageItem[],
): StorageFlow {
  const { origin, storageType, key, value, links, intermeds } = unchecked;
  const hostname = new URL(origin).hostname;

  let candidates = storageItems.filter(
    ({ id: storageId, value: storageValue }) =>
      storageType === storageId.storageType &&
      key === storageId.key &&
      value === storageValue &&
      (storageId.storageType === "cookie"
        ? ("." + hostname).endsWith(storageId.domain)
        : origin === storageId.origin),
  );

  if (candidates.length > 1 && storageType === "cookie") {
    const maxLengthDomainCookie = _.maxBy(
      candidates as Cookie[],
      ({ id: { domain } }) => domain.length,
    );
    assert(maxLengthDomainCookie);
    candidates = [maxLengthDomainCookie];
  }

  if (candidates.length !== 1) {
    // TODO: test (warn if multiple candidates)
    throw new Error(
      candidates.length === 0
        ? `No storage item candidates for ${storageType}:${key}`
        : `Multiple storage item candidates for ${storageType}:${key}`,
    );
  }

  const [storageItem] = candidates;
  return {
    storageItem,
    links,
    intermeds,
  };
}
