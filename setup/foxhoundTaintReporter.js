"use strict";

(function () {
  const $Reflect$apply = Reflect.apply;

  function unbind(f) {
    return function (thisArg, ...args) {
      return $Reflect$apply(f, thisArg, args);
    };
  }

  const $Array$$map = unbind(Array.prototype.map);

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

  window.addEventListener("__taintreport", (r) => {
    const value = r.detail;
    const taint = value.str.taint;
    const taintReport = simplifyTaintReport({ ...value, taint });
    if (!taintReport) return;
    (window.__playwright_taint_report ?? console.log)(taintReport);
  });

  function combineStorageTaintRanges(ranges) {
    const result = [];
    for (let headIndex = 0; headIndex < ranges.length; ++headIndex) {
      const headRange = ranges[headIndex];
      const { begin: headBegin, flow: headFlow } = headRange;
      const { operation: headOperation, arguments: headArgs } = headFlow;

      checkOperation: switch (headOperation) {
        case "document.cookie":
        case "localStorage.getItem":
        case "sessionStorage.getItem":
          break checkOperation;
        default: {
          result[result.length] = headRange;
          continue;
        }
      }

      let lastIndex = headIndex;
      for (let i = headIndex + 1; i < ranges.length; ++i) {
        const currRange = ranges[i];
        const { begin: currBegin, end: currEnd, flow: currFlow } = currRange;
        const { operation: currOperation, arguments: currArgs } = currFlow;

        const prevRange = ranges[i - 1];
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

      const lastRange = ranges[lastIndex];
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
})();
