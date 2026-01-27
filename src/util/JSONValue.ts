import JsonAsty from "json-asty";
import { toArray } from "iter-tools";

export interface JSONValue {
  type: "string" | "number";
  cooked: string;
  raw: string;
  begin: number;
  end: number;
}

export function parseJSONValues(input: string): JSONValue[] {
  let ast;
  try {
    ast = JsonAsty.parse(input);
  } catch {
    return [];
  }
  return toArray(extractValues(ast));

  function* extractValues(node: any): Generator<JSONValue> {
    const { T: type } = node;
    switch (type) {
      case "string": {
        const {
          A: { body: raw, value: cooked },
          L: { O: begin },
        } = node;
        const end = begin + raw.length;
        yield { type: "string", cooked, raw, begin, end };
        break;
      }
      case "number": {
        const {
          A: { body: raw },
          L: { O: begin },
        } = node;
        const end = begin + raw.length;
        yield { type: "number", cooked: raw, raw, begin, end };
        break;
      }
      case "member": {
        const {
          C: { 1: child },
        } = node;
        yield* extractValues(child);
        break;
      }
      default: {
        for (const child of node.C) {
          yield* extractValues(child);
        }
      }
    }
  }
}
