import { createHash } from "crypto";
import { Transform, TransformGenerator } from "../Transform";

export const SHA1: TransformGenerator = {
  *generate(input) {
    yield new SHA1Transform();
  },
};

export class SHA1Transform implements Transform {
  readonly name: string = "SHA1";

  apply(input: string): string {
    return createHash("sha1").update(input).digest("hex");
  }
}
