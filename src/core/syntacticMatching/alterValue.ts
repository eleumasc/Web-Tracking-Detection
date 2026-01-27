export function* alterValue(
  value: string,
  singleOffset: boolean = true,
): Generator<string> {
  const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowerChars = "abcdefghijklmnopqrstuvwxyz";
  const digitChars = "0123456789";

  const digitMatches = [...value.matchAll(/[0-9]/g)].reverse();
  const upperMatches = [...value.matchAll(/[A-Z]/g)].reverse();
  const lowerMatches = [...value.matchAll(/[a-z]/g)].reverse();

  const maxOffset = singleOffset ? 1 : 25;
  for (let offset = 1; offset <= maxOffset; ++offset) {
    if (offset < 10) {
      for (const match of digitMatches) {
        yield alter(offset, match, digitChars);
      }
    }
    for (const match of upperMatches) {
      yield alter(offset, match, upperChars);
    }
    for (const match of lowerMatches) {
      yield alter(offset, match, lowerChars);
    }
  }

  function alter(
    offset: number,
    match: RegExpExecArray,
    charType: string,
  ): string {
    const { 0: c, index } = match;
    const d = charType[(charType.indexOf(c) + offset) % charType.length];
    return value.slice(0, index) + d + value.slice(index + 1);
  }
}
