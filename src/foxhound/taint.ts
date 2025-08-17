import { getSiteByUrl } from "../util/site";
import { Taint, TaintOperation, TaintReport } from "./types";

export type TaintOperationPredicate = (
  op: TaintOperation,
  taintReport: TaintReport
) => boolean;

export function hasSink(
  taintReport: TaintReport,
  fn: TaintOperationPredicate
): boolean {
  const op = taintReport.taint[0].flow[1];
  if (op) {
    return fn(op, taintReport);
  } else {
    // WTF // data.value.taintReports.find(x => !x.taint[0].flow[1])
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
  fnSource: TaintOperationPredicate,
  fnSink: TaintOperationPredicate
): any[] {
  const { taint, ...rest } = taintReport;
  if (!hasSink(taintReport, fnSink)) {
    return [];
  }
  const digestedSink = taint[0].flow[1];
  const digestedTaint = taint.flatMap((range): Taint => {
    const { flow, ...rest } = range;
    const digestedFlow = range.flow
      .slice(2)
      .filter((op) => fnSource(op, taintReport));
    return digestedFlow.length !== 0 ? [{ ...rest, flow: digestedFlow }] : [];
  });
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
        return (
          getSiteByUrl(documentUrl) !== getSiteByUrl(requestUrl, documentUrl)
        );
      }

      return true;
    };

    switch (op.operation) {
      // XMLHttpRequest
      case "XMLHttpRequest.open(url)":
        return check(taintReport.str);
      case "XMLHttpRequest.send":
      case "XMLHttpRequest.setRequestHeader(value)":
        return check(op.arguments[0]);
      // fetch
      case "fetch.url":
        return check(taintReport.str);
      case "fetch.body":
        return check(op.arguments[0]);
      case "fetch.header(value)":
        // return check(op.arguments[0]);
        return true; // TODO: fix -- add request url to TaintOperation("fetch.header(value)").arguments
      // sendBeacon
      case "navigator.sendBeacon":
        return check(op.arguments[0]);
      // WebSocket
      case "WebSocket":
        return check(taintReport.str);
      case "WebSocket.send":
        return check(op.arguments[0]);
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
        return (
          getSiteByUrl(documentUrl) !== getSiteByUrl(requestUrl, documentUrl)
        );
      }

      return true;
    };

    switch (op.operation) {
      // XMLHttpRequest
      case "XMLHttpRequest.response":
        return check(op.arguments[0]);
      // fetch
      case "fetch.json()":
      case "fetch.text()":
        return true; // TODO: fix -- add request url to TaintOperation("fetch.text" | "fetch.json").arguments
      // WebSocket
      case "WebSocket.MessageEvent.data":
        return true; // TODO: fix -- add request url to TaintOperation("fetch.header(value)").arguments
      // // postMessage
      // case "MessageEvent":
      //   return true;
      default:
        return false;
    }
  };
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
