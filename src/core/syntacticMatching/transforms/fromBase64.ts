import { ToBase64Transform } from "./toBase64";
import { Transform, TransformGenerator } from "../Transform";

export const fromBase64: TransformGenerator = {
  *generate(input, lastTransform) {
    if (lastTransform instanceof ToBase64Transform) return;
    yield new FromBase64Transform();
  },
};

export class FromBase64Transform implements Transform {
  readonly name: string = "fromBase64";

  apply(input: string): string {
    return atob(input);
  }

  reverse(value: string, input: string): string {
    return btoa(value).substring(0, input.length);
  }
}
