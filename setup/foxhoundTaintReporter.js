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
    const sink = taint[0]?.flow[1];
    if (!sink) return;
    return {
      ...taintReport,
      sink,
      taint: $Array$$map(taint, (range) => {
        const { flow } = range;
        return {
          ...range,
          flow: flow[flow.length - 1],
        };
      }),
    };
  }

  window.addEventListener("__taintreport", (r) => {
    const value = r.detail;
    const taint = value.str.taint;
    const taintReport = simplifyTaintReport({ ...value, taint });
    if (!taintReport) return;
    window.__playwright_taint_report(taintReport);
  });
})();
