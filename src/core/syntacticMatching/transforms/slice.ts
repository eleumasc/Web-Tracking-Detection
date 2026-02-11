import replaceStringAt, { Transform } from "../Transform";
import { Token } from "../Token";

export function sliceToken(token: Token, begin: number, end: number): Token {
  const transform = new SliceTransform(begin, end);
  return {
    chain: token,
    transform,
    value: transform.apply(token.value),
  };
}

export class SliceTransform implements Transform {
  readonly name: string = "slice";

  constructor(readonly begin: number, readonly end: number) {}

  apply(input: string): string {
    return input.substring(this.begin, this.end);
  }

  reverse(value: string, input: string): string {
    return replaceStringAt(input, value, this.begin, this.end);
  }
}
