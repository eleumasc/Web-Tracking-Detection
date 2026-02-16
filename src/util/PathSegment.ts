import { enumerate } from "iter-tools";

export interface PathSegment {
  raw: string;
  index: number;
  begin: number;
  end: number;
}

export function parsePathSegments(input: string): PathSegment[] {
  const result: PathSegment[] = [];

  for (const [index, match] of enumerate(input.matchAll(/\/([^\/]*)/g))) {
    const { 1: raw, index: matchIndex } = match;

    const begin = matchIndex + 1;
    const end = begin + raw.length;

    result.push({
      raw,
      index,
      begin,
      end,
    });
  }

  return result;
}
