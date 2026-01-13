import replaceStringAt, { Transform, TransformType } from "../Transform";
import { parseQueryParams } from "../../../util/QueryParam";

export const fromQueryValues: TransformType = {
  *generateTransforms(input) {
    let params;
    try {
      params = parseQueryParams(input);
    } catch {
      return;
    }

    for (const { name: namePart, value: valuePart } of params) {
      const { raw, index: begin } =
        valuePart && valuePart.raw ? valuePart : namePart;
      const end = begin + raw.length;
      yield new FromQueryValuesTransform(begin, end);
    }
  },
};

export class FromQueryValuesTransform implements Transform {
  readonly name: string = "fromQueryValues";

  constructor(readonly begin: number, readonly end: number) {}

  apply(input: string): string {
    return input.substring(this.begin, this.end);
  }

  reverse(value: string, originalInput: string): string {
    return replaceStringAt(originalInput, value, this.begin, this.end);
  }
}
