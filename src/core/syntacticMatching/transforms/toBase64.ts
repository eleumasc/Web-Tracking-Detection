import { FromBase64Transform } from "./fromBase64";
import { Transform, TransformType } from "../Transform";

export const toBase64: TransformType = {
  *generateTransforms(input) {
    yield new ToBase64Transform();
  },

  inverts(transform) {
    return transform instanceof FromBase64Transform;
  },
};

export class ToBase64Transform implements Transform {
  readonly name: string = "toBase64";

  apply(input: string): string {
    return btoa(input);
  }

  reverse(value: string, originalInput: string): string {
    return atob(value);
  }
}
