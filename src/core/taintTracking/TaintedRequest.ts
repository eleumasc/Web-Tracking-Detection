import _ from "lodash";
import { findRequestId, Har } from "../../util/Har";
import { FoxReport } from "../../foxhound/types";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { StorageItem } from "../StorageItem";
import {
  TaintedRequestParam,
  tryParseNetworkSinkOperation,
} from "./NetworkSinkOperation";
import {
  tryCheckStorageTaintArray,
  getUncheckedStorageTaints,
  StorageTaint,
} from "./StorageTaint";

export interface TaintedRequest {
  requestId: string;
  url: string;
  postData?: string;
  storageTaints?: StorageTaint[];
}

export function computeTaintedRequests(
  foxReports: FoxReport[],
  storageItems: StorageItem[],
  har: Har,
): TaintedRequest[] {
  interface TaintedRequestReportEntry {
    requestId?: string;
    url: string;
    requestParam: TaintedRequestParam;
    foxReport: FoxReport;
  }

  // Filter FoxReports involving a NetworkSinkOperation
  const taintedRequestReportEntries: TaintedRequestReportEntry[] = [];
  for (const foxReport of foxReports) {
    const networkSinkOperation = tryParseNetworkSinkOperation(
      foxReport.sinkOperation,
      foxReport,
    );
    if (networkSinkOperation) {
      taintedRequestReportEntries.push({ ...networkSinkOperation, foxReport });
    }
  }

  // Process requests in HAR for which there is a corresponding FoxReport
  // involving a TaintedRequestParam
  const taintedRequests: TaintedRequest[] = [];
  for (const harEntry of har.entries()) {
    const requestId = findRequestId(harEntry);
    if (!requestId) continue;

    const { request } = harEntry;
    const { url: requestUrl } = request;

    const matchesRequest = (entry: TaintedRequestReportEntry): boolean =>
      entry.requestId
        ? entry.requestId === requestId // match by requestId (XMLHttpRequest, fetch, navigator.sendBeacon)
        : entry.url === requestUrl; // match by URL (location, Element.src)

    let storageTaints: StorageTaint[] = [];

    const urlReportEntry = taintedRequestReportEntries.find(
      (entry) => entry.requestParam === "url" && matchesRequest(entry),
    );
    // TODO: mark urlReportEntry as picked
    if (urlReportEntry) {
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
    const postDataReportEntry = taintedRequestReportEntries.find(
      (entry) => entry.requestParam === "postData" && matchesRequest(entry),
    );
    if (postDataReportEntry) {
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

    storageTaints = storageTaints.filter((storageTaint) =>
      isCharConcatReadFromStorageIdentifiable(storageTaint),
    );

    if (storageTaints.length > 0) {
      taintedRequests.push({
        requestId,
        url: requestUrl,
        postData,
        storageTaints,
      });
    }
  }

  return taintedRequests;
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

// Checks whether accessed indexes of storage value form at least one
// contiguous sequence that is identifiable
function someSequenceReadFromStorageIdentifiable(
  storageTaint: StorageTaint,
): boolean {
  const {
    storageItem: { value },
    links,
  } = storageTaint;

  const indexes = _.sortBy(
    _.uniq(links.map(([, storageIndex]) => storageIndex)),
  );

  const sequences: string[] = [];
  let beginIndex = indexes[0];
  let previousIndex = indexes[0];
  for (let i = 1; i <= indexes.length; i++) {
    const cur = indexes[i];
    if (cur !== previousIndex + 1) {
      sequences.push(value.slice(beginIndex, previousIndex + 1));
      beginIndex = cur;
    }
    previousIndex = cur;
  }

  return sequences.some((sequence) => isIdentifiable(sequence));
}
