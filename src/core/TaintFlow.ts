import assert from "assert";
import { Range } from "../util/Range";
import {
  FoxhoundLocation,
  FoxhoundOperation,
  FoxhoundReport,
} from "../foxhound/types";

export type TaintFlow = {
  str: string;
  sink: TaintOperation;
  sources: TaintOperation[];
};

export interface BaseTaintOperation {
  type: string;
  location: string;
}

export interface NetworkTaintOperation extends BaseTaintOperation {
  type: "Network";
  requestUrl: string;
}

export interface StorageTaintOperation extends BaseTaintOperation {
  type: "Storage";
  storageType: string;
  key: string;
  value: string;
  valueRange: Range;
}

export type TaintOperation = NetworkTaintOperation | StorageTaintOperation;

export function getTaintFlowsFromFoxhoundReports(
  foxhoundReports: FoxhoundReport[]
): TaintFlow[] {
  const cx: ToTaintOperationContext = {
    storageMap: createStorageMap(foxhoundReports),
  };
  const flows: TaintFlow[] = [];
  for (const report of foxhoundReports) {
    const { str, sink: foxhoundSink, taint } = report;
    const sink = toTaintOperation(cx, foxhoundSink, report);
    if (!sink) continue;
    const sources: TaintOperation[] = [];
    for (const { begin, end, flow: foxhoundSource } of taint) {
      const source = toTaintOperation(cx, foxhoundSource, report);
      if (!source) continue;
      sources.push(source);
    }
    flows.push({ str, sink, sources });
  }
  return flows;
}

interface ToTaintOperationContext {
  storageMap: Map<string, string>;
}

function toTaintOperation(
  cx: ToTaintOperationContext,
  foxhoundOperation: FoxhoundOperation,
  foxhoundReport: FoxhoundReport
): TaintOperation | null {
  try {
    for (const fn of [toTaintNetworkOperation, toTaintStorageOperation]) {
      const taintOperation = fn(cx, foxhoundOperation, foxhoundReport);
      if (taintOperation) return taintOperation;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

function toTaintNetworkOperation(
  cx: ToTaintOperationContext,
  foxhoundOperation: FoxhoundOperation,
  { str, baseURI }: FoxhoundReport
): TaintOperation | null {
  let requestUrl: string;
  switch (foxhoundOperation.operation) {
    // SINKS
    //
    // XMLHttpRequest
    case "XMLHttpRequest.open(url)":
      requestUrl = str;
      break;
    case "XMLHttpRequest.send":
      requestUrl = foxhoundOperation.arguments[0];
      break;
    // fetch
    case "fetch.url":
      requestUrl = str;
      break;
    case "fetch.body":
      requestUrl = foxhoundOperation.arguments[0];
      break;
    // sendBeacon
    case "navigator.sendBeacon(url)":
      requestUrl = str;
      break;
    case "navigator.sendBeacon(body)":
      requestUrl = foxhoundOperation.arguments[0];
      break;
    // WebSocket
    // case "WebSocket":
    //   requestUrl = taintOperation.arguments[0];
    //   break;
    // case "WebSocket.send":
    //   requestUrl = taintOperation.arguments[0];
    //   break;
    //
    // location (SINK-ONLY)
    case "location.pathname":
    case "location.search":
    case "location.hash":
    case "location.href":
    case "location.assign":
    case "location.replace": {
      if (!foxhoundOperation.source) {
        requestUrl = str;
      } else {
        return null;
      }
      break;
    }
    //
    // DOM
    case "iframe.src":
    case "img.src":
    case "script.src": {
      requestUrl = str;
      break;
    }
    //
    // SOURCES
    //
    // XMLHttpRequest
    case "XMLHttpRequest.response":
    case "XMLHttpRequest.response(json)":
      requestUrl = foxhoundOperation.arguments[0];
      break;
    // fetch
    case "fetch.text()":
    case "fetch.json()":
      requestUrl = foxhoundOperation.arguments[0];
      break;
    // WebSocket
    // case "WebSocket.MessageEvent.data": // TODO: fix location in Foxhound
    //   requestUrl = taintOperation.arguments[0];
    //   break;
    //
    default:
      return null;
  }
  if (
    requestUrl.startsWith("data:") ||
    requestUrl.startsWith("blob:") ||
    requestUrl.startsWith("javascript:")
  ) {
    return null;
  }
  if (!URL.canParse(requestUrl, baseURI)) {
    console.log(
      `[toTaintNetworkOperation.ParseURL] ${foxhoundOperation.operation} ${requestUrl}`
    );
    return null;
  }
  requestUrl = new URL(requestUrl, baseURI).href;
  const location = getLocation(foxhoundOperation.location);
  if (!location) return null;
  return {
    type: "Network",
    location,
    requestUrl,
  };
}

function toTaintStorageOperation(
  cx: ToTaintOperationContext,
  foxhoundOperation: FoxhoundOperation,
  { str, taint: foxhoundTaint }: FoxhoundReport
): TaintOperation | null {
  let storageType: string;
  let key: string;
  let value: string;
  let valueRange: StorageTaintOperation["valueRange"];
  const getValueRangeForSource = (): typeof valueRange => {
    const { arguments: taintArgs } = foxhoundOperation;
    const foxhoundRange = foxhoundTaint.find(
      ({ flow: operation }) => operation === foxhoundOperation
    );
    assert(foxhoundRange);
    const { begin: rangeBegin, end: rangeEnd } = foxhoundRange;
    const [beginStr, endStr] = taintArgs[2].split(":");
    if (beginStr === "undefined" && endStr === "NaN") {
      // This case should happen only in taint flows where the sink is StorageRead
      return { begin: 0, end: rangeEnd - rangeBegin };
    }
    const begin = +beginStr;
    const end = +endStr;
    assert(!isNaN(begin));
    return { begin, end };
  };
  const getValueRangeForSink = (): typeof valueRange => {
    return { begin: 0, end: str.length };
  };
  switch (foxhoundOperation.operation) {
    case "document.cookie": {
      storageType = "cookie";
      if (foxhoundOperation.source) {
        // get document.cookie
        let version: string;
        [key, version] = foxhoundOperation.arguments;
        value = getStorageMapValue(
          cx.storageMap,
          getStorageMapKey(storageType, key, version)
        );
        valueRange = getValueRangeForSource();
      } else {
        // set document.cookie
        const sc = str.indexOf(";");
        const kvStr = sc !== -1 ? str.substring(0, sc) : str;
        [key, value] = parseCookieKeyValueString(kvStr);
        valueRange = getValueRangeForSink();
      }
      break;
    }
    case "localStorage.getItem": {
      storageType = "localStorage";
      let version: string;
      [key, version] = foxhoundOperation.arguments;
      value = getStorageMapValue(
        cx.storageMap,
        getStorageMapKey(storageType, key, version)
      );
      valueRange = getValueRangeForSource();
      break;
    }
    case "localStorage.setItem": {
      storageType = "localStorage";
      key = foxhoundOperation.arguments[0];
      value = str;
      valueRange = getValueRangeForSink();
      break;
    }
    // case "localStorage.setItem(key)": {
    //   storageType = "localStorage";
    //   key = str;
    //   value = taintOperation.arguments[0];
    //   break;
    // }
    case "sessionStorage.getItem": {
      storageType = "sessionStorage";
      let version: string;
      [key, version] = foxhoundOperation.arguments;
      value = getStorageMapValue(
        cx.storageMap,
        getStorageMapKey(storageType, key, version)
      );
      valueRange = getValueRangeForSource();
      break;
    }
    case "sessionStorage.setItem": {
      storageType = "sessionStorage";
      key = foxhoundOperation.arguments[0];
      value = str;
      valueRange = getValueRangeForSink();
      break;
    }
    // case "sessionStorage.setItem(key)": {
    //   storageType = "sessionStorage";
    //   key = str;
    //   value = taintOperation.arguments[0];
    //   break;
    // }
    default:
      return null;
  }
  const location = getLocation(foxhoundOperation.location);
  if (!location) return null;
  return {
    type: "Storage",
    location,
    storageType,
    key,
    value,
    valueRange,
  };
}

function getLocation(foxhoundLocation: FoxhoundLocation): string | null {
  const { filename } = foxhoundLocation;
  if (URL.canParse(filename)) {
    return filename;
  }
  const moduleSep = filename.indexOf("<@");
  if (moduleSep !== -1) {
    const moduleFilename = filename.substring(moduleSep + 2);
    if (URL.canParse(moduleFilename)) {
      return moduleFilename;
    }
  }
  console.log(`[getLocation.ParseURL] ${filename}`);
  return null;
}

////

export type StorageOperation = {
  type: "Read" | "Write";
  location: string;
  storageType: string;
  key: string;
  value: string;
  timestamp: number;
};

export function getStorageOperationsFromFoxhoundReports(
  taintReports: FoxhoundReport[]
): StorageOperation[] {
  const cx: ToTaintOperationContext = {
    storageMap: createStorageMap(taintReports),
  };
  const storageOperations: StorageOperation[] = [];
  for (const taintReport of taintReports) {
    const { sink: taintSink, taint, timestamp: unsafeTimestamp } = taintReport;
    const timestamp =
      typeof unsafeTimestamp === "number"
        ? unsafeTimestamp
        : Date.parse(unsafeTimestamp);
    assert(!isNaN(timestamp));
    if (taintSink.operation === "StorageRead") {
      for (const { begin, end, flow: taintSource } of taint) {
        const source = toTaintStorageOperation(cx, taintSource, taintReport);
        if (!source) continue;
        const { location, storageType, key, value } =
          source as StorageTaintOperation;
        storageOperations.push({
          type: "Read",
          location,
          storageType,
          key,
          value,
          timestamp,
        });
      }
    } else {
      const sink = toTaintStorageOperation(cx, taintSink, taintReport);
      if (!sink) continue;
      const { location, storageType, key, value } =
        sink as StorageTaintOperation;
      storageOperations.push({
        type: "Write",
        location,
        storageType,
        key,
        value,
        timestamp,
      });
    }
  }
  return storageOperations;
}

////

function createStorageMap(
  foxhoundReports: FoxhoundReport[]
): Map<string, string> {
  const storageMap = new Map<string, string>();
  for (const foxhoundReport of foxhoundReports) {
    const { str, sink: foxhoundSink, taint: foxhoundTaint } = foxhoundReport;
    if (foxhoundSink.operation !== "StorageRead") continue;
    const firstFoxhoundSource = foxhoundTaint[0].flow;
    switch (firstFoxhoundSource.operation) {
      case "document.cookie": {
        for (const [key, value, version] of str
          .split("; ")
          .map((kvStr) => parseCookieKeyValueString(kvStr))
          .filter(([_key, value]) => value.length > 0)
          .map((kvArray, index) => {
            const [key] = kvArray;
            const foxhoundSource = foxhoundTaint[index].flow;
            assert(foxhoundSource.operation === "document.cookie");
            const [argsKey, version] = foxhoundSource.arguments;
            assert(key === argsKey);
            return [...kvArray, version];
          })) {
          setStorageMapValue(
            storageMap,
            getStorageMapKey("cookie", key, version),
            value
          );
        }
        break;
      }
      case "localStorage.getItem": {
        const [key, version] = firstFoxhoundSource.arguments;
        setStorageMapValue(
          storageMap,
          getStorageMapKey("localStorage", key, version),
          str
        );
        break;
      }
      case "sessionStorage.getItem": {
        const [key, version] = firstFoxhoundSource.arguments;
        setStorageMapValue(
          storageMap,
          getStorageMapKey("sessionStorage", key, version),
          str
        );
        break;
      }
    }
  }
  return storageMap;
}

function getStorageMapKey(
  storageType: string,
  key: string,
  version: string
): string {
  return `${version}:${storageType}:${key}`;
}

function getStorageMapValue(
  storageMap: Map<string, string>,
  storageMapKey: string
): string {
  const value = storageMap.get(storageMapKey);
  assert(value !== undefined);
  return value;
}

function setStorageMapValue(
  storageMap: Map<string, string>,
  storageMapKey: string,
  value: string
): void {
  assert(!storageMap.has(storageMapKey));
  storageMap.set(storageMapKey, value);
}

function parseCookieKeyValueString(kvStr: string): [string, string] {
  const eq = kvStr.indexOf("=");
  const key = eq !== -1 ? kvStr.substring(0, eq).trim() : "";
  const value = eq !== -1 ? kvStr.substring(eq + 1).trim() : kvStr.trim();
  return [key, value];
}
