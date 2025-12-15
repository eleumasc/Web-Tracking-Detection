import zxcvbn from "zxcvbn";

export function isIdentifiable(value: string): boolean {
  return isLengthIdentifiable(value) && isZxcvbnIdentifiable(value);
}

export function isLengthIdentifiable(value: string): boolean {
  return value.length >= 8;
}

export function isZxcvbnIdentifiable(value: string): boolean {
  return value.length >= 128 || zxcvbn(value).guesses_log10 >= 9;
}
