import zxcvbn from "zxcvbn";
import { countAlphanumChars } from "../../util/countChars";

export function isIdentifiable(value: string): boolean {
  return isLengthIdentifiable(value) && isZxcvbnIdentifiable(value);
}

export function isLengthIdentifiable(value: string): boolean {
  // formerly: value.length >= 8
  return countAlphanumChars(value) >= 8;
}

export function isZxcvbnIdentifiable(value: string): boolean {
  return value.length >= 128 || zxcvbn(value).guesses_log10 >= 9;
}
