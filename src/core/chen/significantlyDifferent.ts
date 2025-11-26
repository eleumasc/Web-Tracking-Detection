import findLCSubString from "./findLCSubString";
import { findMinLexicographicalLCS } from "@algorithm.ts/lcs";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_UNIX_TIMESTAMP = +new Date(CURRENT_YEAR - 1, 0, 1); // first day of last year
const MAX_UNIX_TIMESTAMP = +new Date(CURRENT_YEAR + 2, 0, 1); // first day of second next year

// WARNING! This function is guaranteed to work as expected when the distance
// between included timestamps and the current time is at most one year.
function removeUnixTimestamps(str: string): string {
  return str.replace(/[1-9][0-9]+/g, (numStr) => {
    const num = Number(numStr);
    if (
      [0, 3].some((exp) => {
        // 0 if potential timestamp in num is in ms
        // 3 if potential timestamp in num is in seconds
        const fixedNum = Math.floor(num * Math.pow(10, exp));
        return fixedNum >= MIN_UNIX_TIMESTAMP && fixedNum < MAX_UNIX_TIMESTAMP;
      })
    ) {
      return "";
    }
    return numStr;
  });
}

function removeTimestamps(str: string): string {
  return removeUnixTimestamps(str);
}

function removeAtIndexes(str: string, indexes: number[]): string {
  const indexesSet = new Set(indexes);
  let result = "";
  for (let i = 0; i < str.length; i++) {
    if (!indexesSet.has(i)) {
      result += str[i];
    }
  }
  return result;
}

function removeRecurrentSubstrings(
  str1: string,
  str2: string
): [string, string] {
  let lcs;
  while (
    (lcs = findMinLexicographicalLCS(
      str1.length,
      str2.length,
      (x, y) => str1[x] === str2[y]
    )).length > 2
  ) {
    str1 = removeAtIndexes(
      str1,
      lcs.map((x) => x[0])
    );
    str2 = removeAtIndexes(
      str2,
      lcs.map((x) => x[1])
    );
  }
  return [str1, str2];
}

function countMatchingCharacters(str1: string, str2: string): number {
  const { length, offset1, offset2 } = findLCSubString(str1, str2);
  if (length > 0) {
    return (
      length +
      countMatchingCharacters(
        str1.substring(0, offset1),
        str2.substring(0, offset2)
      ) +
      countMatchingCharacters(
        str1.substring(offset1 + length),
        str2.substring(offset2 + length)
      )
    );
  } else {
    return 0;
  }
}

function similarityScore(str1: string, str2: string): number {
  if (str1.length === 0 && str2.length === 0) {
    return 1;
  } else {
    return (
      (2 * countMatchingCharacters(str1, str2)) / (str1.length + str2.length)
    );
  }
}

export default function significantlyDifferent(
  str1: string,
  str2: string
): boolean {
  const SCORE_THRESHOLD = 0.66;

  if (str1 === str2) {
    return false;
  } else {
    let s1 = str1;
    let s2 = str2;
    s1 = removeTimestamps(s1);
    s2 = removeTimestamps(s2);
    [s1, s2] = removeRecurrentSubstrings(s1, s2);
    return similarityScore(s1, s2) < SCORE_THRESHOLD;
  }
}
