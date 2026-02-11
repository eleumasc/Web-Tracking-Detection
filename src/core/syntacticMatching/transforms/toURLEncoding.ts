import { FromURLEncodingTransform } from "./fromURLEncoding";
import { Transform, TransformGenerator } from "../Transform";

export const toUrlEncoding: TransformGenerator = {
  *generate(input, lastTransform) {
    if (lastTransform instanceof FromURLEncodingTransform) return;
    yield new ToURLEncodingTransform();
  },
};

export class ToURLEncodingTransform implements Transform {
  readonly name: string = "toURLEncoding";

  apply(input: string): string {
    return encodeURIComponent(input);
  }

  reverse(value: string, input: string): string {
    return decodeURIComponent(value);
  }
}
