import _ from "lodash";
import { findRequestId, Har, isRedirectFollowupRequest } from "../../util/Har";
import { FoxReport } from "../../foxhound/types";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { Request } from "../Request";
import { StorageItem } from "../StorageItem";
import {
  TaintRequestParam,
  tryParseNetworkSinkOperation,
} from "./NetworkSinkOperation";
import {
  tryCheckStorageTaintArray,
  getUncheckedStorageTaints,
  StorageTaint,
} from "./StorageTaint";

export interface TaintRequest extends Request {
  postData?: string;
  storageTaints?: StorageTaint[];
}

export function computeTaintRequests(
  foxReports: FoxReport[],
  storageItems: StorageItem[],
  har: Har,
): TaintRequest[] {
  interface TaintRequestReportEntry {
    requestId?: string;
    url: string;
    requestParam: TaintRequestParam;
    foxReport: FoxReport;
  }

  // Filter FoxReports involving a NetworkSinkOperation
  const taintRequestReportEntries: TaintRequestReportEntry[] = [];
  for (const foxReport of foxReports) {
    const networkSinkOperation = tryParseNetworkSinkOperation(
      foxReport.sinkOperation,
      foxReport,
    );
    if (networkSinkOperation) {
      taintRequestReportEntries.push({ ...networkSinkOperation, foxReport });
    }
  }

  // Ensure that each param of each request in HAR matches some FoxReport at
  // most once
  const urlReportEntryFoundSet = new Set<TaintRequestReportEntry>();
  const postDataReportEntryFoundSet = new Set<TaintRequestReportEntry>();

  // Process requests in HAR for which there is a corresponding FoxReport
  // involving a TaintRequestParam
  const taintRequests: TaintRequest[] = [];
  for (const harEntry of har.entries()) {
    const requestId = findRequestId(harEntry);
    if (!requestId) continue;
    if (isRedirectFollowupRequest(harEntry, har)) continue;

    const { request } = harEntry;
    const { url: requestUrl } = request;

    const matchesRequest = (entry: TaintRequestReportEntry): boolean =>
      entry.requestId
        ? entry.requestId === requestId // match by requestId (XMLHttpRequest, fetch, navigator.sendBeacon)
        : entry.url === requestUrl; // match by URL (location, Element.src)

    let storageTaints: StorageTaint[] = [];

    const urlReportEntry = taintRequestReportEntries.find(
      (entry) =>
        entry.requestParam === "url" &&
        matchesRequest(entry) &&
        !urlReportEntryFoundSet.has(entry),
    );
    if (urlReportEntry) {
      urlReportEntryFoundSet.add(urlReportEntry);
      const { foxReport } = urlReportEntry;
      const uncheckedArray = getUncheckedStorageTaints(
        foxReport.taint,
        foxReport,
        "url",
      );
      const urlStorageTaints = tryCheckStorageTaintArray(
        uncheckedArray,
        storageItems,
      );
      if (urlStorageTaints) {
        storageTaints = storageTaints.concat(urlStorageTaints);
      }
    }

    let postData: string | undefined;

    const postDataReportEntry = taintRequestReportEntries.find(
      (entry) =>
        entry.requestParam === "postData" &&
        matchesRequest(entry) &&
        !postDataReportEntryFoundSet.has(entry),
    );
    if (postDataReportEntry) {
      postDataReportEntryFoundSet.add(postDataReportEntry);
      const { foxReport } = postDataReportEntry;
      const uncheckedArray = getUncheckedStorageTaints(
        foxReport.taint,
        foxReport,
        "postData",
      );
      const postDataStorageTaints = tryCheckStorageTaintArray(
        uncheckedArray,
        storageItems,
      );
      if (postDataStorageTaints) {
        storageTaints = storageTaints.concat(postDataStorageTaints);
      }
    }

    // Filter taints based on identification power
    storageTaints = storageTaints.filter((storageTaint) =>
      isCharConcatReadFromStorageIdentifiable(storageTaint),
    );

    if (storageTaints.length > 0) {
      taintRequests.push({
        requestId,
        url: requestUrl,
        postData,
        storageTaints,
      });
    }
  }

  return taintRequests;
}

// Checks whether the concatenation of characters at accessed indexes of
// storage value form a string that is identifiable
function isCharConcatReadFromStorageIdentifiable(
  storageTaint: StorageTaint,
): boolean {
  const {
    storageItem: { value },
    links,
  } = storageTaint;

  const indexes = _.sortBy(
    _.uniq(links.map(([, storageIndex]) => storageIndex)),
  );

  const charConcat = indexes.map((i) => value.at(i)).join("");

  return isIdentifiable(charConcat);
}
