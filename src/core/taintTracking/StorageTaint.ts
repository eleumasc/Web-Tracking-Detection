import _ from "lodash";
import assert from "assert";
import { clusterObjectsBy } from "../../util/cluster";
import { Cookie, StorageItem } from "../StorageItem";
import { FoxRange, FoxReport } from "../../foxhound/types";
import { FoxURL } from "../../foxhound/FoxURL";
import { range, toArray } from "iter-tools";
import { TaintRequestParam } from "./NetworkSinkOperation";
import { tryParseStorageCharFlow } from "./StorageCharFlow";
import {
  extractPathSegmentsWithLoc,
  extractPostDataComponentsWithLoc,
  extractQueryParametersWithLoc,
} from "../RequestParam";

export interface StorageTaint {
  storageItem: StorageItem;
  requestParam: TaintRequestParam;
  links: Link[];
  intermeds: string[];
}

// 1st: requestIndex, 2nd: storageIndex
export type Link = [number, number];

export interface UncheckedStorageTaint {
  origin: string;
  storageType: string;
  key: string;
  value: string;
  requestParam: TaintRequestParam;
  links: Link[];
  intermeds: string[];
}

export function getUncheckedStorageTaints(
  foxTaint: FoxRange[],
  foxReport: FoxReport,
  requestParam: TaintRequestParam,
): UncheckedStorageTaint[] {
  const origin = new URL(foxReport.loc).origin;

  let fixLinks: ((links: Link[]) => Link[]) | undefined;
  let filterLinks: (links: Link[]) => Link[];
  if (requestParam === "Url") {
    const foxUrl = new FoxURL(foxReport.str, foxReport.baseURI);
    fixLinks = (links) =>
      links.map(
        ([requestIndex, storageIndex]): Link =>
          //
          [requestIndex + foxUrl.inputLoc.begin, storageIndex],
      );

    const taintableParams = [
      ...extractPathSegmentsWithLoc(foxUrl),
      ...extractQueryParametersWithLoc(foxUrl),
    ];
    filterLinks = (links) =>
      links.filter(([requestIndex]) =>
        taintableParams.some(
          ({ begin, end }) => requestIndex >= begin && requestIndex <= end,
        ),
      );
  } else {
    const taintableParams = extractPostDataComponentsWithLoc(foxReport.str);
    filterLinks = (links) =>
      links.filter(([requestIndex]) =>
        taintableParams.some(
          ({ begin, end }) => requestIndex >= begin && requestIndex <= end,
        ),
      );
  }

  return clusterObjectsBy(
    foxTaint.flatMap((foxRange) => {
      const storageCharFlow = tryParseStorageCharFlow(foxRange);
      return storageCharFlow ? [storageCharFlow] : [];
    }),
    ({ storageType, key, value }) => [storageType, key, value],
  )
    .map((cluster): UncheckedStorageTaint => {
      const { storageType, key, value } = cluster[0];

      let links = cluster.flatMap(({ begin, end, storageIndex }) =>
        toArray(range(begin, end)) //
          .map((requestIndex): Link => [requestIndex, storageIndex]),
      );
      if (fixLinks) {
        links = fixLinks(links);
      }
      links = filterLinks(links);

      const intermeds = _.uniq(cluster.flatMap(({ intermeds }) => intermeds));

      return {
        origin,
        storageType,
        key,
        value,
        requestParam,
        links,
        intermeds,
      };
    })
    .filter(({ links }) => links.length > 0);
}

export function tryCheckStorageTaintArray(
  uncheckedArray: UncheckedStorageTaint[],
  storageItems: StorageItem[],
): StorageTaint[] | undefined {
  const checkedArray = uncheckedArray.flatMap((unchecked) => {
    const checked = tryCheckStorageTaint(unchecked, storageItems);
    return checked ? [checked] : [];
  });
  return checkedArray.length > 0 ? checkedArray : undefined;
}

export function tryCheckStorageTaint(
  unchecked: UncheckedStorageTaint,
  storageItems: StorageItem[],
): StorageTaint | undefined {
  try {
    return checkStorageTaint(unchecked, storageItems);
  } catch {
    return;
  }
}

export function checkStorageTaint(
  unchecked: UncheckedStorageTaint,
  storageItems: StorageItem[],
): StorageTaint {
  const { origin, storageType, key, value, requestParam, links, intermeds } =
    unchecked;
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
    requestParam,
    links,
    intermeds,
  };
}
