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
  RequestParam,
  RequestParamEntryWithLoc,
} from "../RequestParam";

export interface StorageTaint {
  storageItem: StorageItem;
  linksEntries: LinksEntry[];
  intermeds: string[];
}

export interface LinksEntry {
  requestParam: RequestParam;
  links: Link[];
}

// 1st: requestIndex, 2nd: storageIndex
export type Link = [number, number];

export interface UncheckedStorageTaint {
  origin: string;
  storageType: string;
  key: string;
  value: string;
  linksEntries: LinksEntry[];
  intermeds: string[];
}

export function getUncheckedStorageTaints(
  foxTaint: FoxRange[],
  foxReport: FoxReport,
  taintParam: TaintRequestParam,
): UncheckedStorageTaint[] {
  const origin = new URL(foxReport.loc).origin;

  const doComputeLinksEntries = (
    inputLinks: Link[],
    paramEntries: RequestParamEntryWithLoc[],
  ): LinksEntry[] =>
    paramEntries
      .map(
        ({ param, begin, end }): LinksEntry => ({
          requestParam: param,
          links: inputLinks.filter(
            ({ 0: requestIndex }) =>
              requestIndex >= begin && requestIndex <= end,
          ),
        }),
      )
      .filter(({ links }) => links.length > 0);

  let computeLinksEntries: (inputLinks: Link[]) => LinksEntry[];
  if (taintParam === "Url") {
    const foxUrl = new FoxURL(foxReport.str, foxReport.baseURI);
    const paramEntries = [
      ...extractPathSegmentsWithLoc(foxUrl),
      ...extractQueryParametersWithLoc(foxUrl),
    ];
    computeLinksEntries = (inputLinks) => {
      // fix misalignment between input and fully parsed URL
      inputLinks = inputLinks.map(
        ([requestIndex, storageIndex]): Link =>
          //
          [requestIndex + foxUrl.inputLoc.begin, storageIndex],
      );
      return doComputeLinksEntries(inputLinks, paramEntries);
    };
  } else {
    const paramEntries = extractPostDataComponentsWithLoc(foxReport.str);
    computeLinksEntries = (inputLinks) => {
      return doComputeLinksEntries(inputLinks, paramEntries);
    };
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

      const rawLinks = cluster.flatMap(({ begin, end, storageIndex }) =>
        toArray(range(begin, end)) //
          .map((requestIndex): Link => [requestIndex, storageIndex]),
      );

      const linksEntries = computeLinksEntries(rawLinks);

      const intermeds = _.uniq(cluster.flatMap(({ intermeds }) => intermeds));

      return {
        origin,
        storageType,
        key,
        value,
        linksEntries,
        intermeds,
      };
    })
    .filter(({ linksEntries }) => linksEntries.length > 0);
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
  const { origin, storageType, key, value, linksEntries, intermeds } =
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
    linksEntries,
    intermeds,
  };
}
