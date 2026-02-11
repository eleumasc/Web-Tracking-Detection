import assert from "assert";

export interface Transform {
  name: string;
  apply(input: string): string;
  reverse?(value: string, input: string): string;
}

export interface TransformGenerator {
  generate(input: string, lastTransform?: Transform): Iterable<Transform>;
}

export default function replaceStringAt(
  original: string,
  replacement: string,
  begin: number,
  end: number,
): string {
  assert(replacement.length === end - begin);
  return original.substring(0, begin) + replacement + original.substring(end);
}
