import _ from "lodash";
import { FoxReport } from "../../foxhound/types";
import { Har } from "../../util/Har";
import { StorageItem } from "../StorageItem";
import { tryParseNetworkSinkOperation } from "./NetworkSinkOperation";
import {
  tryCheckStorageFlowArray,
  getUncheckedStorageFlows,
  StorageFlow,
} from "./StorageFlow";

export interface TaintedRequest {
  requestId: string;
  url: string;
  postData?: string;
  urlStorageFlows?: StorageFlow[];
  postDataStorageFlows?: StorageFlow[];
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
  for (const { request } of har.entries()) {
    const requestId = request.headers.find(
      ({ name }) => name === "X-Foxhound-RequestId",
    )?.value;
    if (!requestId) continue;

    const matchesRequest = (entry: TaintedRequestReportEntry): boolean =>
      entry.requestId
        ? entry.requestId === requestId // match by requestId (XMLHttpRequest, fetch, navigator.sendBeacon)
        : entry.url === request.url; // match by URL (location, Element.src)

    let urlStorageFlows: StorageFlow[] | undefined;
    const urlReportEntry = taintedRequestReportEntries.find(
      (entry) => entry.argType === "url" && matchesRequest(entry),
    );
    if (urlReportEntry) {
      const { foxReport } = urlReportEntry;
      const uncheckedArray = getUncheckedStorageFlows(
        foxReport.taint,
        foxReport,
        true,
      );
      urlStorageFlows = tryCheckStorageFlowArray(uncheckedArray, storageItems);
    }

    let postData: string | undefined;
    let postDataStorageFlows: StorageFlow[] | undefined;
    const postDataReportEntry = taintedRequestReportEntries.find(
      (entry) => entry.argType === "postData" && matchesRequest(entry),
    );
    if (postDataReportEntry) {
      const { foxReport } = postDataReportEntry;
      const uncheckedArray = getUncheckedStorageFlows(
        foxReport.taint,
        foxReport,
      );
      postDataStorageFlows = tryCheckStorageFlowArray(
        uncheckedArray,
        storageItems,
      );
    }

    if (urlStorageFlows || postDataStorageFlows) {
      taintedRequests.push({
        requestId,
        url: request.url,
        postData,
        urlStorageFlows,
        postDataStorageFlows,
      });
    }
  }

  return taintedRequests;
}
