"use strict";

(function () {
  const { toCompact } = import$toCompact();

  window.addEventListener("__taintreport", ({ detail: value }) => {
    const log = window.__foxhoundTaintReporter ?? console.log;
    const foxReport = createFoxhoundReport(value);
    if (foxReport) {
      log(toCompact(foxReport));
    }
  });

  function createFoxhoundReport(value) {
    const { taint } = value.str;
    if (!taint) return;
    const sinkOperation = taint[0]?.flow[0];
    if (!sinkOperation) return;
    const { sink, ...rest } = value;
    return {
      ...rest,
      sinkOperation,
      taint,
    };
  }

  function import$toCompact() {
    const isArray = Array.isArray;
    const keys = Object.keys;
    const $Map = Map;
    const $Map$$get = Map.prototype.get;
    const $Map$$set = Map.prototype.set;
    const $WeakMap = WeakMap;
    const $WeakMap$$get = WeakMap.prototype.get;
    const $WeakMap$$set = WeakMap.prototype.set;

    function toCompact(value) {
      return stringifyTop();

      function stringifyTop() {
        const t = typeof value;
        if (
          t === "boolean" ||
          t === "number" ||
          t === "string" ||
          t === "undefined" ||
          value === null
        ) {
          return value;
        } else if (t === "object") {
          return createTopArray(value);
        } else {
          throw `Unsupported value for Compact: ${value}`;
        }
      }

      function createTopArray(value) {
        const strMap = new $Map();
        const objMap = new $WeakMap();
        const $topArray = [];
        visit(value);
        return $topArray;

        function visit(v) {
          const t = typeof v;
          if (
            t === "boolean" ||
            t === "number" ||
            t === "undefined" ||
            v === null
          ) {
            return v;
          } else if (t === "string") {
            let $k = $Map$$get.apply(strMap, [v]);
            if ($k === void 0) {
              $k = $topArray.length++;
              $Map$$set.apply(strMap, [v, $k]);
              $topArray[$k] = v;
            }
            return `${$k}`;
          } else if (t === "object") {
            let $k = $WeakMap$$get.apply(objMap, [v]);
            if ($k === void 0) {
              $k = $topArray.length++;
              $WeakMap$$set.apply(objMap, [v, $k]);
              $topArray[$k] = createCompactObject(v);
            }
            return `${$k}`;
          } else {
            throw `Unsupported value for Compact: ${v}`;
          }
        }

        function createCompactObject(v) {
          if (isArray(v)) {
            const $v = [];
            for (let i = 0; i < v.length; ++i) {
              $v[$v.length] = visit(v[i]);
            }
            return $v;
          } else {
            const $v = { __proto__: null };
            const K = keys(v);
            for (let i = 0; i < K.length; ++i) {
              const k = K[i];
              const e = v[k];
              if (e !== void 0) {
                $v[visit(k)] = visit(e);
              }
            }
            return $v;
          }
        }
      }
    }

    return { toCompact };
  }
})();
