import _ from "lodash";
import { findRequestId, Har } from "../../util/Har";
import { FoxReport } from "../../foxhound/types";
import { StorageItem } from "../StorageItem";
import { tryParseNetworkSinkOperation } from "./NetworkSinkOperation";
import {
  tryCheckStorageTaintArray,
  getUncheckedStorageTaints,
  StorageTaint,
} from "./StorageTaint";

export interface TaintedRequest {
  requestId: string;
  url: string;
  postData?: string;
  urlStorageTaints?: StorageTaint[];
  postDataStorageTaints?: StorageTaint[];
}

export function computeTaintedRequests(
  foxReports: FoxReport[],
  storageItems: StorageItem[],
  har: Har,
): TaintedRequest[] {
  interface TaintedRequestReportEntry {
    requestId?: string;
    url: string;
    argType: "url" | "postData";
    foxReport: FoxReport;
  }

  // Collect entries from FoxReports involving NetworkSinkOperations
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
  // involving url or postData
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

    let urlStorageTaints: StorageTaint[] | undefined;
    const urlReportEntry = taintedRequestReportEntries.find(
      (entry) => entry.argType === "url" && matchesRequest(entry),
    );
    if (urlReportEntry) {
      const { foxReport } = urlReportEntry;
      const uncheckedArray = getUncheckedStorageTaints(
        foxReport.taint,
        foxReport,
        true,
      );
      urlStorageTaints = tryCheckStorageTaintArray(
        uncheckedArray,
        storageItems,
      );
    }

    let postData: string | undefined;
    let postDataStorageTaints: StorageTaint[] | undefined;
    const postDataReportEntry = taintedRequestReportEntries.find(
      (entry) => entry.argType === "postData" && matchesRequest(entry),
    );
    if (postDataReportEntry) {
      const { foxReport } = postDataReportEntry;
      const uncheckedArray = getUncheckedStorageTaints(
        foxReport.taint,
        foxReport,
      );
      postDataStorageTaints = tryCheckStorageTaintArray(
        uncheckedArray,
        storageItems,
      );
    }

    if (urlStorageTaints || postDataStorageTaints) {
      taintedRequests.push({
        requestId,
        url: requestUrl,
        postData,
        urlStorageTaints,
        postDataStorageTaints,
      });
    }
  }

  return taintedRequests;
}
