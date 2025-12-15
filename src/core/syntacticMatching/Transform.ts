import JsonAsty from "json-asty";
import { createHash } from "crypto";
import { parseQueryParams } from "../../util/QueryParam";
import { Range } from "../../util/Range";

export type Transform = {
  name: string;
  transformValue: (value: string) => Iterable<TransformedValue>;
  rebuildRange?: (value: string, requiredLength: number) => string;
  inverts?: (transform: Transform) => boolean;
};

export type TransformedValue = {
  value: string;
  range: Range;
};

function createTransform(args: {
  name: string;
  transformValue: (value: string) => Iterable<string | TransformedValue>;
  rebuildRange?: (value: string, requiredLength: number) => string;
  inverts?: (other: Transform) => boolean;
}): Transform {
  const { name, transformValue, rebuildRange, inverts } = args;

  return {
    name,
    *transformValue(input) {
      for (const r of transformValue(input)) {
        const value = typeof r === "string" ? r : r.value;
        const range =
          typeof r === "string"
            ? <Range>{ begin: 0, end: input.length }
            : r.range;
        yield { value, range };
      }
    },
    rebuildRange,
    inverts,
  };
}

export const fromBase64 = createTransform({
  name: "fromBase64",
  transformValue: function* (value) {
    try {
      yield atob(value);
    } catch {
      return;
    }
  },
  rebuildRange: function (value, requiredLength) {
    return btoa(value).substring(0, requiredLength);
  },
  inverts: function (other) {
    return other === toBase64;
  },
});

export const fromURLEncoding = createTransform({
  name: "fromURLEncoding",
  transformValue: function* (value) {
    try {
      const decoded = decodeURIComponent(value);
      if (encodeURIComponent(decoded) === value) {
        yield decoded;
      }
    } catch {
      return;
    }
  },
  rebuildRange: function (value) {
    return encodeURIComponent(value);
  },
  inverts: function (other) {
    return other === toURLEncoding;
  },
});

export const fromJSON = createTransform({
  name: "fromJSON",
  transformValue: function* (whole) {
    let ast;
    try {
      ast = JsonAsty.parse(whole);
    } catch {
      return;
    }

    yield* extractStringValues(ast);

    function* extractStringValues(node: any): Generator<TransformedValue> {
      const { T: type } = node;
      switch (type) {
        case "string": {
          const {
            A: { body: raw, value },
            L: { O: begin },
          } = node;
          yield {
            value,
            range: { begin, end: begin + raw.length },
          };
          break;
        }
        case "member": {
          const {
            C: { 1: child },
          } = node;
          yield* extractStringValues(child);
          break;
        }
        default: {
          for (const child of node.C) {
            yield* extractStringValues(child);
          }
        }
      }
    }
  },
  rebuildRange: function (value) {
    return JSON.stringify(value);
  },
});

export const fromQueryValues = createTransform({
  name: "fromQueryValues",
  transformValue: function* (whole) {
    let params;
    try {
      params = parseQueryParams(whole);
    } catch {
      return;
    }

    for (const { key: keyPart, value: valuePart } of params) {
      const { raw: value, index: begin } =
        valuePart && valuePart.raw ? valuePart : keyPart;
      yield {
        value,
        range: { begin, end: begin + value.length },
      };
    }
  },
  rebuildRange: function (value) {
    return value;
  },
});

export const split = createTransform({
  name: "split",
  transformValue: function* (whole) {
    for (const { 0: value, index: begin } of whole.matchAll(/[A-Za-z0-9]+/g)) {
      yield {
        value,
        range: { begin, end: begin + value.length },
      };
    }
  },
  rebuildRange: function (value) {
    return value;
  },
});

export const toBase64 = createTransform({
  name: "toBase64",
  transformValue: function* (value) {
    try {
      yield btoa(value);
    } catch {
      return;
    }
  },
  rebuildRange: function (value) {
    return atob(value);
  },
  inverts: function (other) {
    return other === fromBase64;
  },
});

export const toURLEncoding = createTransform({
  name: "toURLEncoding",
  transformValue: function* (value) {
    yield encodeURIComponent(value);
  },
  rebuildRange: function (value) {
    return decodeURIComponent(value);
  },
  inverts: function (other) {
    return other === fromURLEncoding;
  },
});

export const MD5 = createTransform({
  name: "MD5",
  transformValue: function* (value) {
    yield createHash("md5").update(value).digest("hex");
  },
});

export const SHA1 = createTransform({
  name: "SHA1",
  transformValue: function* (value) {
    yield createHash("sha1").update(value).digest("hex");
  },
});

export const slice = (begin: number, end: number) =>
  createTransform({
    name: "slice",
    transformValue: function* (value) {
      yield {
        value: value.substring(begin, end),
        range: { begin, end },
      };
    },
    rebuildRange(value) {
      return value;
    },
  });
