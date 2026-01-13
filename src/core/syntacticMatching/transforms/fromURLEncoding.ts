import assert from "assert";
import { ToURLEncodingTransform } from "./toURLEncoding";
import { Transform, TransformType } from "../Transform";

export const fromUrlEncoding: TransformType = {
  *generateTransforms(input) {
    yield new FromURLEncodingTransform();
  },

  inverts(transform) {
    return transform instanceof ToURLEncodingTransform;
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
