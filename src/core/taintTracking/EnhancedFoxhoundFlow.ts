import assert from "assert";
import { Range } from "../../util/Range";
import {
  FoxhoundLocation,
  FoxhoundOperation,
  FoxhoundReport,
} from "../../foxhound/types";

export type EnhancedFoxhoundFlow = {
  str: string;
  sink: EnhancedFoxhoundOperation;
  ranges: EnhancedFoxhoundRange[];
};

export type EnhancedFoxhoundRange = {
  begin: number;
  end: number;
  source: EnhancedFoxhoundOperation;
};

export interface BaseEnhancedFoxhoundOperation {
  type: string;
  location: string;
}

export interface NetworkEnhancedFoxhoundOperation
  extends BaseEnhancedFoxhoundOperation {
  type: "Network";
  requestUrl: string;
}

export interface StorageEnhancedFoxhoundOperation
  extends BaseEnhancedFoxhoundOperation {
  type: "Storage";
  storageType: string;
  key: string;
  value: string;
  valueRange: Range;
  locUrl: URL;
}

export type EnhancedFoxhoundOperation =
  | NetworkEnhancedFoxhoundOperation
  | StorageEnhancedFoxhoundOperation;

export function parseFoxhoundReports(
  foxhoundReports: FoxhoundReport[]
): EnhancedFoxhoundFlow[] {
  const cx: ToEnhancedOperationContext = {
    storageMap: createStorageMap(foxhoundReports),
  };
  const enhancedFlows: EnhancedFoxhoundFlow[] = [];
  for (const foxhoundReport of foxhoundReports) {
    const { str, sink: foxhoundSink, taint } = foxhoundReport;
    const sink = toEnhancedOperation(cx, foxhoundSink, foxhoundReport);
    if (!sink) continue;
    const ranges: EnhancedFoxhoundRange[] = [];
    for (const { begin, end, flow: foxhoundSource } of taint) {
      const source = toEnhancedOperation(cx, foxhoundSource, foxhoundReport);
      if (!source) continue;
      ranges.push({ begin, end, source });
    }
    enhancedFlows.push({ str, sink, ranges });
  }
  return enhancedFlows;
}

interface ToEnhancedOperationContext {
  storageMap: Map<string, string>;
}

function toEnhancedOperation(
  cx: ToEnhancedOperationContext,
  foxhoundOperation: FoxhoundOperation,
  foxhoundReport: FoxhoundReport
): EnhancedFoxhoundOperation | null {
  try {
    for (const fn of [toNetworkEnhancedOperation, toStorageEnhancedOperation]) {
      const enhancedOperation = fn(cx, foxhoundOperation, foxhoundReport);
      if (enhancedOperation) return enhancedOperation;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

function toNetworkEnhancedOperation(
  cx: ToEnhancedOperationContext,
  foxhoundOperation: FoxhoundOperation,
  { str, baseURI }: FoxhoundReport
): NetworkEnhancedFoxhoundOperation | null {
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
    //   requestUrl = foxhoundOperation.arguments[0];
    //   break;
    // case "WebSocket.send":
    //   requestUrl = foxhoundOperation.arguments[0];
    //   break;
    //
    // location (SINK-ONLY)
    case "location.pathname":
    case "location.search":
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
    console.error(
      `[toNetworkTaintOperation.ParseURL] ${foxhoundOperation.operation} ${requestUrl}`
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

function toStorageEnhancedOperation(
  cx: ToEnhancedOperationContext,
  foxhoundOperation: FoxhoundOperation,
  { loc, str, taint: foxhoundTaint }: FoxhoundReport
): StorageEnhancedFoxhoundOperation | null {
  let storageType: string;
  let key: string;
  let value: string;
  let valueRange: StorageEnhancedFoxhoundOperation["valueRange"];
  const getValueRangeForSource = (): typeof valueRange => {
    const { arguments: taintArgs } = foxhoundOperation;
    const foxhoundRange = foxhoundTaint.find(
      ({ flow: operation }) => operation === foxhoundOperation
    );
    assert(foxhoundRange);
    const { begin: rangeBegin, end: rangeEnd } = foxhoundRange;
    if (taintArgs[2] === undefined) {
      // This case should happen only in taint flows where the sink is StorageRead
      return { begin: 0, end: rangeEnd - rangeBegin };
    }
    const [beginStr, endStr] = taintArgs[2].split(":");
    const begin = Number(beginStr);
    const end = Number(endStr);
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
    locUrl: new URL(loc),
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
  console.error(`[getLocation.ParseURL] ${filename}`);
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
  const cx: ToEnhancedOperationContext = {
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
        const source = toStorageEnhancedOperation(cx, taintSource, taintReport);
        if (!source) continue;
        const { location, storageType, key, value } =
          source as StorageEnhancedFoxhoundOperation;
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
      const sink = toStorageEnhancedOperation(cx, taintSink, taintReport);
      if (!sink) continue;
      const { location, storageType, key, value } =
        sink as StorageEnhancedFoxhoundOperation;
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
  assert(value !== undefined, `Storage map entry not found: ${storageMapKey}`);
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
