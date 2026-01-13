import { createHash } from "crypto";
import { Transform, TransformType } from "../Transform";

export const MD5: TransformType = {
  *generateTransforms(input) {
    yield new MD5Transform();
  },
};

export class MD5Transform implements Transform {
  readonly name: string = "MD5";

  apply(input: string): string {
    return createHash("md5").update(input).digest("hex");
  }
}
