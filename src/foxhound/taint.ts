import _ from "lodash";
import { getSiteByUrl } from "../util/site";
import { Taint, TaintOperation, TaintReport } from "./types";

export type TaintOperationPredicate = (
  op: TaintOperation,
  taintReport: TaintReport
) => boolean;

export type TaintPredicate = (
  taint: Taint,
  taintReport: TaintReport
) => boolean;

export function hasSink(
  taintReport: TaintReport,
  fn: TaintOperationPredicate
): boolean {
  const op = taintReport.taint[0]?.flow[1];
  if (op) {
    return fn(op, taintReport);
  } else {
    // WTF // data.value.taintReports.find(x => !x.taint[0]?.flow[1])
    return false;
  }
}

export function hasSource(
  taintReport: TaintReport,
  fn: TaintOperationPredicate
): boolean {
  return taintReport.taint.some((range) =>
    range.flow.slice(2).some((op) => fn(op, taintReport))
  );
}

export function digestTaintReport(
  taintReport: TaintReport,
  srcPredicate: TaintOperationPredicate,
  snkPredicate: TaintOperationPredicate,
  taintPredicate?: TaintPredicate
) {
  const { taint, ...rest } = taintReport;
  if (!hasSink(taintReport, snkPredicate)) {
    return [];
  }
  const digestedSink = taint[0].flow[1];
  const digestedTaint = taint.flatMap((range): Taint => {
    const { flow, ...rest } = range;
    const digestedFlow = range.flow
      .slice(2)
      .filter((op) => srcPredicate(op, taintReport));
    return digestedFlow.length !== 0 ? [{ ...rest, flow: digestedFlow }] : [];
  });
  if (taintPredicate && !taintPredicate(digestedTaint, taintReport)) {
    return [];
  }
  return digestedTaint.length !== 0
    ? [{ ...rest, sink: digestedSink, taint: digestedTaint }]
    : [];
}

// Password

export function isPasswordSource(password: string): TaintOperationPredicate {
  return (op) =>
    op.operation === "element.attribute" &&
    op.arguments[1] === `value=${JSON.stringify(password)}`;
}

// Storage

export function isStorageSink(): TaintOperationPredicate {
  return (op) => {
    switch (op.operation) {
      case "document.cookie":
      case "localStorage.setItem":
      case "localStorage.setItem(key)":
        return true;
      default:
        return false;
    }
  };
}

export function isStorageSource(): TaintOperationPredicate {
  return (op) => {
    switch (op.operation) {
      case "document.cookie":
      case "localStorage.getItem":
      case "localStorage.getItem":
        return true;
      default:
        return false;
    }
  };
}

// Network

export function isNetworkSink(
  options: {
    crossSiteRequest?: boolean;
  } = {
    crossSiteRequest: false,
  }
): TaintOperationPredicate {
  return (op, taintReport) => {
    const check = (requestUrl: string): boolean => {
      if (options.crossSiteRequest) {
        const documentUrl = taintReport.loc;
        return getSiteByUrl(documentUrl) !== getSiteByUrl(requestUrl);
      }
      return true;
    };

    switch (op.operation) {
      // XMLHttpRequest
      case "XMLHttpRequest.open(url)":
      case "XMLHttpRequest.send":
      case "XMLHttpRequest.setRequestHeader(value)":
      // fetch
      case "fetch.url":
      case "fetch.body":
      case "fetch.header(value)":
      // sendBeacon
      case "navigator.sendBeacon":
      // WebSocket
      case "WebSocket":
      case "WebSocket.send":
        return check(
          getNetworkTaintOperationRequestURLArgument(op, taintReport.str)
        );
      // // postMessage
      // case "window.postMessage":
      //   return true;
      default:
        return false;
    }
  };
}

export function isNetworkSource(
  options: {
    crossSiteRequest?: boolean;
  } = {
    crossSiteRequest: false,
  }
): TaintOperationPredicate {
  return (op, taintReport) => {
    const check = (requestUrl: string): boolean => {
      if (options.crossSiteRequest) {
        const documentUrl = taintReport.loc;
        return getSiteByUrl(documentUrl) !== getSiteByUrl(requestUrl);
      }
      return true;
    };

    switch (op.operation) {
      // XMLHttpRequest
      case "XMLHttpRequest.response":
      // fetch
      case "fetch.json()":
      case "fetch.text()":
      // WebSocket
      case "WebSocket.MessageEvent.data":
        return check(
          getNetworkTaintOperationRequestURLArgument(op, taintReport.str)
        );
      // // postMessage
      // case "MessageEvent":
      //   return true;
      default:
        return false;
    }
  };
}

export function isMultiOriginNetworkTaint(): TaintPredicate {
  return (taint, taintReport) => {
    const uniqueDomains = _.uniq(
      taint.flatMap(({ flow }) => {
        const requestUrl = getNetworkTaintOperationRequestURLArgument(
          flow[0],
          taintReport.str
        );
        return URL.canParse(requestUrl) ? [new URL(requestUrl).hostname] : [];
      })
    );
    return uniqueDomains.length >= 2;
  };
}

export function getNetworkTaintOperationRequestURLArgument(
  op: TaintOperation,
  taintStr: string
): string {
  switch (op.operation) {
    // SINKS
    //
    // XMLHttpRequest
    case "XMLHttpRequest.open(url)":
      return taintStr; // foxhound-fixed (complete URL)
    case "XMLHttpRequest.send":
    case "XMLHttpRequest.setRequestHeader(value)":
      return op.arguments[0];
    // fetch
    case "fetch.url":
      return taintStr;
    case "fetch.body":
      return op.arguments[0];
    case "fetch.header(value)":
      return op.arguments[0]; // foxhound-fixed
    // sendBeacon
    case "navigator.sendBeacon":
      return op.arguments[0];
    // WebSocket
    case "WebSocket":
      return op.arguments[0]; // foxhound-fixed (complete URL)
    case "WebSocket.send":
      return op.arguments[0];
    //
    // SOURCES
    //
    // XMLHttpRequest
    case "XMLHttpRequest.response":
      return op.arguments[0];
    // fetch
    case "fetch.json()":
    case "fetch.text()":
      return op.arguments[0]; // foxhound-fixed
    // WebSocket
    case "WebSocket.MessageEvent.data":
      return op.arguments[0]; // foxhound-fixed
    //
    default:
      throw new Error(`Not a network taint operation: ${op.operation}`);
  }
}

// Loc

export function isLocSink(): TaintOperationPredicate {
  return (op) => {
    switch (op.operation) {
      case "location.search":
      case "location.hash":
      case "location.href":
      case "location.replace":
        return true;
      default:
        return false;
    }
  };
}

export function isLocSource(): TaintOperationPredicate {
  return (op) => {
    switch (op.operation) {
      case "location.search":
      case "location.hash":
      case "location.href":
        return true;
      default:
        return false;
    }
  };
}
