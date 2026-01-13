import { ToBase64Transform } from "./toBase64";
import { Transform, TransformType } from "../Transform";

export const fromBase64: TransformType = {
  *generateTransforms(input) {
    yield new FromBase64Transform();
  },

  inverts(transform) {
    return transform instanceof ToBase64Transform;
  },
};

export class FromBase64Transform implements Transform {
  readonly name: string = "fromBase64";

  apply(input: string): string {
    return atob(input);
  }

  reverse(value: string, originalInput: string): string {
    return btoa(value).substring(0, originalInput.length);
  }
}
