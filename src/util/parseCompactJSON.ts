export function parseCompactJSON(str: string): any {
  return parseTop();

  function parseTop() {
    const $v = JSON.parse(str);
    const t = typeof $v;
    if (
      t === "boolean" ||
      t === "number" ||
      t === "string" ||
      t === "undefined" ||
      $v === null
    ) {
      return $v;
    } else if (Array.isArray($v)) {
      return parseTopArray($v);
    } else {
      throw new SyntaxError(`Invalid top value for CompactJSON: ${$v}`);
    }
  }

  function parseTopArray($topArray: any[]): any {
    const topArray = $topArray.map(($v) => {
      const t = typeof $v;
      if (t === "string") {
        return $v;
      } else if (Array.isArray($v)) {
        return Array($v.length);
      } else if (t === "object" && t) {
        return { __proto__: null };
      } else {
        throw new SyntaxError(
          `Invalid top array element for CompactJSON: ${$v}`,
        );
      }
    });

    if (typeof topArray[0] !== "object") {
      throw new SyntaxError(
        `Expected object as type of first element of top array, but got ${typeof topArray[0]}`,
      );
    }

    for (let i = 0; i < topArray.length; ++i) {
      const v = topArray[i];
      if (typeof v !== "object") {
        continue;
      }
      const $v = $topArray[i];
      if (Array.isArray(v)) {
        for (let j = 0; j < $v.length; ++j) {
          const $e = $v[j];
          const e = typeof $e === "string" ? topArray.at(Number($e)) : $e;
          v[j] = e;
        }
      } else {
        for (const $k of Object.keys($v)) {
          const k = topArray.at(Number($k));
          const $e = $v[$k];
          const e = typeof $e === "string" ? topArray.at(Number($e)) : $e;
          v[k] = e;
        }
      }
    }

    return topArray[0];
  }
}
