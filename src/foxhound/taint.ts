import { Taint, TaintOperation, TaintReport } from "./types";

export type TaintOperationPredicate = (op: TaintOperation) => boolean;

export function hasSink(
  taintReport: TaintReport,
  fn: TaintOperationPredicate
): boolean {
  const op = taintReport.taint[0].flow[1];
  if (op) {
    return fn(op);
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
    range.flow.slice(2).some((op) => fn(op))
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
    const digestedFlow = range.flow.slice(2).filter((op) => fnSource(op));
    return digestedFlow.length !== 0 ? [{ ...rest, flow: digestedFlow }] : [];
  });
  return digestedTaint.length !== 0
    ? [{ ...rest, sink: digestedSink, taint: digestedTaint }]
    : [];
}

export function doesSendPasswordInFlight(
  taintReport: TaintReport,
  password: string
): boolean {
  return (
    hasSink(taintReport, isInFlightNetworkSink()) &&
    hasSource(taintReport, isPasswordSource(password))
  );
}

export function isInFlightNetworkSink(): TaintOperationPredicate {
  return (op) => {
    switch (op.operation) {
      // XMLHttpRequest
      case "XMLHttpRequest.open(url)":
      case "XMLHttpRequest.setRequestHeader(value)":
      case "XMLHttpRequest.send":
      // fetch
      case "fetch.url":
      case "fetch.header(value)":
      case "fetch.body":
      // postMessage
      case "window.postMessage":
        return true;
      default:
        return false;
    }
  };
}

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

export function isNetworkSink(): TaintOperationPredicate {
  return (op) => {
    switch (op.operation) {
      // XMLHttpRequest
      case "XMLHttpRequest.open(url)":
      case "XMLHttpRequest.setRequestHeader(value)":
      case "XMLHttpRequest.send":
      // fetch
      case "fetch.url":
      case "fetch.header(value)":
      case "fetch.body":
      // sendBeacon
      case "navigator.sendBeacon":
      // WebSocket
      case "WebSocket":
      case "WebSocket.send":
        // postMessage
        // case "window.postMessage":
        return true;
      default:
        return false;
    }
  };
}

export function isNetworkSource(): TaintOperationPredicate {
  return (op) => {
    switch (op.operation) {
      // XMLHttpRequest
      case "XMLHttpRequest.response":
      // fetch
      case "fetch.json()":
      case "fetch.text()":
      // WebSocket
      case "WebSocket.MessageEvent.data":
        // postMessage
        // case "MessageEvent":
        return true;
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
