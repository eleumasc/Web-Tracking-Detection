import replaceStringAt, { Transform, TransformGenerator } from "../Transform";
import { parseQueryParams } from "../../../util/QueryParam";

export const fromQueryValues: TransformGenerator = {
  *generate(input, lastTransform) {
    if (lastTransform instanceof FromQueryValuesTransform) return;
    for (const queryParam of parseQueryParams(input)) {
      const { value: valuePart } = queryParam;
      if (!valuePart) continue;
      const { begin, end } = valuePart;
      yield new FromQueryValuesTransform(begin, end);
    }
  },
};

export class FromQueryValuesTransform implements Transform {
  readonly name: string = "fromQueryValues";

  constructor(
    readonly begin: number,
    readonly end: number,
  ) {}

  apply(input: string): string {
    return input.substring(this.begin, this.end);
  }

  reverse(value: string, input: string): string {
    return replaceStringAt(input, value, this.begin, this.end);
  }
}
