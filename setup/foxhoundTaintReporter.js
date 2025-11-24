"use strict";

(function () {
  const $Reflect$apply = Reflect.apply;

  function unbind(f) {
    return function (thisArg, ...args) {
      return $Reflect$apply(f, thisArg, args);
    };
  }

  const $Array$$map = unbind(Array.prototype.map);
  const $Map = window.Map;
  const $Map$$get = unbind(Map.prototype.get);
  const $Map$$set = unbind(Map.prototype.set);

  const leaderWindow = (function () {
    let w = window;
    while (w !== w.top) {
      try {
        void w.parent.location.href;
        w = w.parent;
      } catch (e) {
        break;
      }
    }
    return w;
  })();
  if (window === leaderWindow) {
    const { StorageReadLogManager } = loadStorageReadLogManager();
    const logManager = new StorageReadLogManager();
    window.__foxhound_taint_callback = function (value) {
      const taint = value.str.taint;
      const taintReport = simplifyTaintReport({ ...value, taint });
      if (!taintReport) return;
      const log = window.__foxhoundTaintReporter ?? console.log;
      const toBeLoggedTaintReports =
        logManager.getToBeLoggedTaintReports(taintReport);
      for (let i = 0; i < toBeLoggedTaintReports.length; ++i) {
        log(toBeLoggedTaintReports[i]);
      }
    };
  } else {
    window.__foxhound_taint_callback = function (value) {
      leaderWindow.__foxhound_taint_callback(value);
    };
  }

  function simplifyTaintReport(taintReport) {
    const { taint } = taintReport;
    const sink = taint[0]?.flow[0];
    if (!sink) return;
    return {
      ...taintReport,
      sink,
      taint: combineStorageTaintRanges(
        $Array$$map(taint, (range) => {
          const { flow } = range;
          return {
            ...range,
            flow: flow[flow.length - 1],
          };
        })
      ),
    };
  }

  function isStorageReadOperation(taintOperation) {
    switch (taintOperation.operation) {
      case "document.cookie":
        return taintOperation.source;
      case "localStorage.getItem":
      case "sessionStorage.getItem":
        return true;
      default: {
        return false;
      }
    }
  }

  function combineStorageTaintRanges(taintRanges) {
    const result = [];
    for (let headIndex = 0; headIndex < taintRanges.length; ++headIndex) {
      const headRange = taintRanges[headIndex];
      const { begin: headBegin, flow: headFlow } = headRange;
      const { arguments: headArgs } = headFlow;

      if (!isStorageReadOperation(headFlow)) {
        result[result.length] = headRange;
        continue;
      }

      if (headArgs[2] === undefined) {
        result[result.length] = headRange;
        continue;
      }

      let lastIndex = headIndex;
      for (let i = headIndex + 1; i < taintRanges.length; ++i) {
        const currRange = taintRanges[i];
        const { begin: currBegin, end: currEnd, flow: currFlow } = currRange;
        const { operation: currOperation, arguments: currArgs } = currFlow;

        const prevRange = taintRanges[i - 1];
        const { begin: prevBegin, end: prevEnd, flow: prevFlow } = prevRange;
        const { operation: prevOperation, arguments: prevArgs } = prevFlow;

        if (
          prevBegin + 1 === prevEnd &&
          currBegin + 1 === currEnd &&
          prevEnd === currBegin &&
          prevOperation === currOperation &&
          prevArgs[0] === currArgs[0] && // storageKey
          prevArgs[1] === currArgs[1] && // version
          +prevArgs[2] + 1 === +currArgs[2]
        ) {
          lastIndex = i;
        } else {
          break;
        }
      }

      const lastRange = taintRanges[lastIndex];
      const { end: lastEnd } = lastRange;

      const newRange = {
        begin: headBegin,
        end: lastEnd,
        flow: {
          ...headFlow,
          arguments: [
            headArgs[0],
            headArgs[1],
            `${headArgs[2]}:${+headArgs[2] + (lastIndex - headIndex + 1)}`,
          ],
        },
      };
      result[result.length] = newRange;

      headIndex = lastIndex;
    }
    return result;
  }

  function loadStorageReadLogManager() {
    class StorageReadLogManager {
      constructor() {
        this.storageReadEntryMap = new $Map();
      }

      getToBeLoggedTaintReports(taintReport) {
        if (taintReport.sink.operation === "StorageRead") {
          this._addStorageRead(taintReport);
          return [];
        }

        const { taint } = taintReport;

        let result = [];
        for (let i = 0; i < taint.length; ++i) {
          const taintOperation = taint[i].flow;
          if (!isStorageReadOperation(taintOperation)) continue;
          const version = taintOperation.arguments[1];
          const entry = $Map$$get(this.storageReadEntryMap, version);
          if (!entry) continue;
          if (entry.logged) continue;
          result[result.length] = entry.storageRead;
          entry.logged = true;
        }
        result[result.length] = taintReport;
        return result;
      }

      _addStorageRead(storageRead) {
        const { taint } = storageRead;

        const entry = {
          storageRead,
          logged: false,
        };

        for (let i = 0; i < taint.length; ++i) {
          const taintOperation = taint[i].flow;
          const version = taintOperation.arguments[1];
          $Map$$set(this.storageReadEntryMap, version, entry);
        }
      }
    }

    return { StorageReadLogManager };
  }
})();
