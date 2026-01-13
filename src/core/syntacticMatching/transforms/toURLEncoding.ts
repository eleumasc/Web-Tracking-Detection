import { FromURLEncodingTransform } from "./fromURLEncoding";
import { Transform, TransformType } from "../Transform";

export const toUrlEncoding: TransformType = {
  *generateTransforms(input) {
    yield new ToURLEncodingTransform();
  },

  inverts(transform) {
    return transform instanceof FromURLEncodingTransform;
  },
};

export class ToURLEncodingTransform implements Transform {
  readonly name: string = "toURLEncoding";

  apply(input: string): string {
    return encodeURIComponent(input);
  }

  reverse(value: string, originalInput: string): string {
    return decodeURIComponent(value);
  }
}
