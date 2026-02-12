import { FoxOperation, FoxReport } from "../../foxhound/types";
import { FoxURL } from "../../foxhound/FoxURL";

export interface NetworkSinkOperation {
  requestId?: string;
  url: string;
  requestParam: TaintRequestParam;
}

export type TaintRequestParam = "url" | "postData";

export function tryParseNetworkSinkOperation(
  sinkOperation: FoxOperation,
  foxReport: FoxReport,
): NetworkSinkOperation | undefined {
  try {
    return parseNetworkSinkOperation(sinkOperation, foxReport);
  } catch {
    return;
  }
}

export function parseNetworkSinkOperation(
  sinkOperation: FoxOperation,
  foxReport: FoxReport,
): NetworkSinkOperation {
  const {
    requestId: rawRequestId,
    url: rawUrl,
    requestParam,
  } = doParseNetworkSinkOperation(sinkOperation, foxReport);

  // fix to add redirectCountStr (first request of redirect chain, thus 0)
  const requestId = `${rawRequestId}:0`;

  // we parse rawUrl using FoxURL to compute url (i.e., rawUrl without hash)
  const foxUrl = new FoxURL(rawUrl, foxReport.baseURI);
  const { protocol } = foxUrl;
  if (
    protocol === "about:" ||
    protocol === "blob:" ||
    protocol === "data:" ||
    protocol === "javascript:"
  ) {
    throw new Error(`Not a network protocol: ${protocol}`);
  }

  return { requestId, url: foxUrl.toString(), requestParam };
}

function doParseNetworkSinkOperation(
  sinkOperation: FoxOperation,
  foxReport: FoxReport,
): {
  requestId?: string;
  url: string;
  requestParam: TaintRequestParam;
} {
  const { str } = foxReport;
  const { arguments: args } = sinkOperation;
  switch (sinkOperation.operation) {
    // XMLHttpRequest
    case "XMLHttpRequest.open(url)":
      return { requestId: args[0], url: str, requestParam: "url" };
    case "XMLHttpRequest.send":
      return { requestId: args[1], url: args[0], requestParam: "postData" };
    // fetch
    case "fetch.url":
      return { requestId: args[0], url: str, requestParam: "url" };
    case "fetch.body":
      return { requestId: args[1], url: args[0], requestParam: "postData" };
    // sendBeacon
    case "navigator.sendBeacon(url)":
      return { requestId: args[0], url: str, requestParam: "url" };
    case "navigator.sendBeacon(body)":
      return { requestId: args[1], url: args[0], requestParam: "postData" };
    // location
    case "location.pathname":
    case "location.search":
    case "location.href":
    case "location.assign":
    case "location.replace":
      if (!sinkOperation.source) {
        return { url: str, requestParam: "url" };
      } else {
        break;
      }
    // DOM
    case "iframe.src":
    case "img.src":
    case "script.src":
      return { url: str, requestParam: "url" };
  }
  throw new Error(
    `Cannot parse network sink operation: ${sinkOperation.operation}`,
  );
}
