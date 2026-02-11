import assert from "assert";
import replaceStringAt, { Transform, TransformGenerator } from "../Transform";
import { parseJSONValues } from "../../../util/JSONValue";

export const fromJSON: TransformGenerator = {
  *generate(input) {
    for (const jsonValue of parseJSONValues(input)) {
      const { type, begin, end } = jsonValue;
      yield new FromJSONTransform(type, begin, end);
    }
  },
};

export class FromJSONTransform implements Transform {
  readonly name: string = "fromJSON";

  constructor(
    readonly type: "string" | "number",
    readonly begin: number,
    readonly end: number,
  ) {}

  apply(input: string): string {
    switch (this.type) {
      case "string":
        return JSON.parse(input.substring(this.begin, this.end));
      case "number":
        return input.substring(this.begin, this.end);
    }
  }

  reverse(value: string, input: string): string {
    switch (this.type) {
      case "string":
        return replaceStringAt(
          input,
          JSON.stringify(value),
          this.begin,
          this.end,
        );
      case "number":
        assert(!isNaN(Number(value)));
        return replaceStringAt(input, value, this.begin, this.end);
    }
  }
}
