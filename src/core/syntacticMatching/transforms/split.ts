import replaceStringAt, { Transform, TransformType } from "../Transform";

export const split: TransformType = {
  *generateTransforms(input) {
    for (const { 0: value, index: begin } of input.matchAll(/[A-Za-z0-9]+/g)) {
      const end = begin + value.length;
      yield new SplitTransform(begin, end);
    }
  },
};

export class SplitTransform implements Transform {
  readonly name: string = "split";

  constructor(readonly begin: number, readonly end: number) {}

  apply(input: string): string {
    return input.substring(this.begin, this.end);
  }

  reverse(value: string, originalInput: string): string {
    return replaceStringAt(originalInput, value, this.begin, this.end);
  }
}
