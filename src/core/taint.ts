import { Taint, TaintOperation, TaintReport } from "./foxhound";

export function hasTaintOperation(
  taint: Taint,
  fn: (op: TaintOperation) => boolean
): boolean {
  return taint.some((range) => range.flow.some((op) => fn(op)));
}

export function doesSendPasswordInFlight(
  taintReport: TaintReport,
  password: string
): boolean {
  return (
    isInFlightNetworkSink(taintReport.sink) &&
    hasPasswordSource(taintReport.taint, password)
  );
}

export function isInFlightNetworkSink(sink: string): boolean {
  switch (sink) {
    // XMLHttpRequest
    case "XMLHttpRequest.open(url)":
    case "XMLHttpRequest.setRequestHeader(value)":
    case "XMLHttpRequest.send":
    // fetch
    case "fetch.url":
    case "fetch.header(value)":
    case "fetch.body":
    // WebSocket
    case "WebSocket.send":
    // postMessage
    case "window.postMessage":
      return true;
    default:
      return false;
  }
}

export function isPasswordSource(
  op: TaintOperation,
  password: string
): boolean {
  return (
    op.source &&
    op.operation === "element.attribute" &&
    op.arguments[1] === `value=${JSON.stringify(password)}`
  );
}

export function hasPasswordSource(taint: Taint, password: string): boolean {
  return hasTaintOperation(taint, (op) => isPasswordSource(op, password));
}
