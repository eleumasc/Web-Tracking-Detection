import { createHash } from "crypto";
import { Transform, TransformType } from "../Transform";

export const SHA1: TransformType = {
  *generateTransforms(input) {
    yield new SHA1Transform();
  },
};

export class SHA1Transform implements Transform {
  readonly name: string = "SHA1";

  apply(input: string): string {
    return createHash("sha1").update(input).digest("hex");
  }
}
