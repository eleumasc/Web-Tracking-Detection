"use strict";

(function () {
  const $Reflect$apply = Reflect.apply;

  function unbind(f) {
    return function (thisArg, ...args) {
      return $Reflect$apply(f, thisArg, args);
    };
  }

  const $Array$$map = unbind(Array.prototype.map);
  const $Array$$filter = unbind(Array.prototype.filter);

  function simplifyTaintReport(taintReport) {
    const { taint } = taintReport;
    return {
      ...taintReport,
      taint: $Array$$map(taint, (range) => {
        const { flow } = range;
        return {
          ...range,
          flow: [null, flow[1], ...$Array$$filter(flow, (op) => op.source)],
        };
      }),
    };
  }

  window.addEventListener("__taintreport", (r) => {
    const value = r.detail;
    const taint = value.str.taint;
    const taintReport = simplifyTaintReport({ ...value, taint });
    window.__playwright_taint_report(taintReport);
  });
})();
