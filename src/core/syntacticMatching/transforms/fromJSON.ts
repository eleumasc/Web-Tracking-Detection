import JsonAsty from "json-asty";
import replaceStringAt, { Transform, TransformType } from "../Transform";

export const fromJSON: TransformType = {
  *generateTransforms(input) {
    let ast;
    try {
      ast = JsonAsty.parse(input);
    } catch {
      return;
    }

    yield* extractStringValues(ast);

    function* extractStringValues(node: any): Generator<Transform> {
      const { T: type } = node;
      switch (type) {
        case "string": {
          const {
            A: { body: raw },
            L: { O: begin },
          } = node;
          const end = begin + raw.length;
          yield new FromJSONTransform(begin, end);
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
};

export class FromJSONTransform implements Transform {
  readonly name: string = "fromJSON";

  constructor(readonly begin: number, readonly end: number) {}

  apply(input: string): string {
    return JSON.parse(input.substring(this.begin, this.end));
  }

  reverse(value: string, originalInput: string): string {
    return replaceStringAt(
      originalInput,
      JSON.stringify(value),
      this.begin,
      this.end
    );
  }
}
