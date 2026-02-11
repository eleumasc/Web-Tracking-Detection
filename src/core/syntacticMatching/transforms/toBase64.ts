import { FromBase64Transform } from "./fromBase64";
import { Transform, TransformGenerator } from "../Transform";

export const toBase64: TransformGenerator = {
  *generate(input, lastTransform) {
    if (lastTransform instanceof FromBase64Transform) return;
    yield new ToBase64Transform();
  },
};

export class ToBase64Transform implements Transform {
  readonly name: string = "toBase64";

  apply(input: string): string {
    return btoa(input);
  }

  reverse(value: string, input: string): string {
    return atob(value);
  }
}
