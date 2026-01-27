import assert from "assert";
import { ToURLEncodingTransform } from "./toURLEncoding";
import { Transform, TransformGenerator } from "../Transform";

export const fromUrlEncoding: TransformGenerator = {
  *generate(input, lastTransform) {
    if (lastTransform instanceof ToURLEncodingTransform) return;
    yield new FromURLEncodingTransform();
  },
};

export class FromURLEncodingTransform implements Transform {
  readonly name: string = "fromURLEncoding";

  apply(input: string): string {
    const decoded = decodeURIComponent(input);
    assert(encodeURIComponent(decoded) === input);
    return decoded;
  }

  reverse(value: string, originalInput: string): string {
    return encodeURIComponent(value);
  }
}
