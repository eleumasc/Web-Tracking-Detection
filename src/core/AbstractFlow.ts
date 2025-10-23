import assert from "assert";
import { TaintLocation, TaintOperation, TaintReport } from "../foxhound/types";

export type AbstractFlow = {
  sink: AbstractOperation;
  sources: AbstractOperation[];
};

export interface BaseAbstractOperation {
  type: string;
  location: string;
}

export interface NetworkAbstractOperation extends BaseAbstractOperation {
  type: "Network";
  requestUrl: string;
}

export interface StorageAbstractOperation extends BaseAbstractOperation {
  type: "Storage";
  itemId: string;
  storageType: string;
  key: string;
  value: string;
}

export type AbstractOperation =
  | NetworkAbstractOperation
  | StorageAbstractOperation;

export function getAbstractFlowsFromTaintReports(
  taintReports: TaintReport[]
): AbstractFlow[] {
  const cx: ToAbstractOperationContext = {
    storageMap: createStorageMap(taintReports),
  };
  const flows: AbstractFlow[] = [];
  for (const taintReport of taintReports) {
    const { sink: taintSink, taint } = taintReport;
    const sink = toAbstractOperation(cx, taintSink, taintReport);
    if (!sink) continue;
    const sources: AbstractOperation[] = [];
    for (const { begin, end, flow: taintSource } of taint) {
      const source = toAbstractOperation(cx, taintSource, taintReport);
      if (!source) continue;
      sources.push(source);
    }
    flows.push({ sink, sources });
  }
  return flows;
}

interface ToAbstractOperationContext {
  storageMap: Map<string, string>;
}

function toAbstractOperation(
  cx: ToAbstractOperationContext,
  taintOperation: TaintOperation,
  taintReport: TaintReport
): AbstractOperation | null {
  try {
    for (const fn of [toAbstractNetworkOperation, toAbstractStorageOperation]) {
      const absOp = fn(cx, taintOperation, taintReport);
      if (absOp) return absOp;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

function toAbstractNetworkOperation(
  cx: ToAbstractOperationContext,
  taintOperation: TaintOperation,
  { str, baseURI }: TaintReport
): AbstractOperation | null {
  let requestUrl: string;
  switch (taintOperation.operation) {
    // SINKS
    //
    // XMLHttpRequest
    case "XMLHttpRequest.open(url)":
      requestUrl = str;
      break;
    case "XMLHttpRequest.send":
      requestUrl = taintOperation.arguments[0];
      break;
    // fetch
    case "fetch.url":
      requestUrl = str;
      break;
    case "fetch.body":
      requestUrl = taintOperation.arguments[0];
      break;
    // sendBeacon
    case "navigator.sendBeacon(url)":
      requestUrl = str;
      break;
    case "navigator.sendBeacon(body)":
      requestUrl = taintOperation.arguments[0];
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
      if (!taintOperation.source) {
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
      requestUrl = taintOperation.arguments[0];
      break;
    // fetch
    case "fetch.text()":
    case "fetch.json()":
      requestUrl = taintOperation.arguments[0];
      break;
    // WebSocket
    // case "WebSocket.MessageEvent.data": // TODO: fix location in Foxhound
    //   requestUrl = taintOperation.arguments[0];
    //   break;
    //
    default:
      return null;
  }
  if (!URL.canParse(requestUrl, baseURI)) {
    console.log(
      `[toAbstractNetworkOperation.ParseURL] ${taintOperation.operation} ${requestUrl}`
    );
    return null;
  }
  requestUrl = new URL(requestUrl, baseURI).href;
  const location = getLocation(taintOperation.location);
  if (!location) return null;
  return {
    type: "Network",
    location,
    requestUrl,
  };
}

function toAbstractStorageOperation(
  cx: ToAbstractOperationContext,
  taintOperation: TaintOperation,
  { str }: TaintReport
): AbstractOperation | null {
  let storageType: string;
  let key: string;
  let value: string;
  switch (taintOperation.operation) {
    case "document.cookie": {
      storageType = "cookie";
      if (taintOperation.source) {
        // get document.cookie
        let version: string;
        [key, version] = taintOperation.arguments;
        value = getStorageMapValue(
          cx.storageMap,
          getStorageMapKey(storageType, key, version)
        );
      } else {
        // set document.cookie
        const sc = str.indexOf(";");
        const kvStr = sc !== -1 ? str.substring(0, sc) : str;
        [key, value] = parseCookieKeyValueString(kvStr);
      }
      break;
    }
    case "localStorage.getItem": {
      storageType = "localStorage";
      let version: string;
      [key, version] = taintOperation.arguments;
      value = getStorageMapValue(
        cx.storageMap,
        getStorageMapKey(storageType, key, version)
      );
      break;
    }
    case "localStorage.setItem": {
      storageType = "localStorage";
      key = taintOperation.arguments[0];
      value = str;
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
      [key, version] = taintOperation.arguments;
      value = getStorageMapValue(
        cx.storageMap,
        getStorageMapKey(storageType, key, version)
      );
      break;
    }
    case "sessionStorage.setItem": {
      storageType = "sessionStorage";
      key = taintOperation.arguments[0];
      value = str;
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
  const itemId = `${storageType}:${key}`;
  const location = getLocation(taintOperation.location);
  if (!location) return null;
  return {
    type: "Storage",
    location,
    itemId,
    storageType,
    key,
    value,
  };
}

function getLocation(taintLocation: TaintLocation): string | null {
  const { filename } = taintLocation;
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
  itemId: string;
  value: string;
  timestamp: number;
};

export function getStorageOperationsFromTaintReports(
  taintReports: TaintReport[]
): StorageOperation[] {
  const cx: ToAbstractOperationContext = {
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
        const source = toAbstractStorageOperation(cx, taintSource, taintReport);
        if (!source) continue;
        const { location, itemId, value } = source as StorageAbstractOperation;
        storageOperations.push({
          type: "Read",
          location,
          itemId,
          value,
          timestamp,
        });
      }
    } else {
      const sink = toAbstractStorageOperation(cx, taintSink, taintReport);
      if (!sink) continue;
      const { location, itemId, value } = sink as StorageAbstractOperation;
      storageOperations.push({
        type: "Write",
        location,
        itemId,
        value,
        timestamp,
      });
    }
  }
  return storageOperations;
}

function createStorageMap(taintReports: TaintReport[]): Map<string, string> {
  const storageMap = new Map<string, string>();
  for (const taintReport of taintReports) {
    const { str, sink: taintSink, taint } = taintReport;
    if (taintSink.operation !== "StorageRead") continue;
    const firstTaintSource = taint[0].flow;
    switch (firstTaintSource.operation) {
      case "document.cookie": {
        for (const [key, value, version] of str
          .split("; ")
          .map((kvStr, index) => {
            const kvArray = parseCookieKeyValueString(kvStr);
            const [key] = kvArray;
            const taintSource = taint[index].flow;
            assert(taintSource.operation === "document.cookie");
            const [argsKey, version] = taintSource.arguments;
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
        const [key, version] = firstTaintSource.arguments;
        setStorageMapValue(
          storageMap,
          getStorageMapKey("localStorage", key, version),
          str
        );
        break;
      }
      case "sessionStorage.getItem": {
        const [key, version] = firstTaintSource.arguments;
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
