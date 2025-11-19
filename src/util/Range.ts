export type Range = {
  begin: number;
  end: number;
};

export function minHittingPoints(
  ranges: Range[],
  predicate?: (x: number) => boolean
): number[] {
  const sorted = [...ranges].sort((r1, r2) => r1.end - r2.end);

  const points: number[] = [];
  let lastPoint: number | undefined;

  for (const { begin, end } of sorted) {
    const hits =
      lastPoint !== undefined && begin <= lastPoint && lastPoint < end;

    if (!hits) {
      let picked: number | undefined;

      for (let x = end - 1; x >= begin; x--) {
        if (predicate?.(x) ?? true) {
          picked = x;
          break;
        }
      }

      if (picked === undefined) {
        throw new Error(
          `No point satisfying predicate exists in range [${begin}, ${end})`
        );
      }

      lastPoint = picked;
      points.push(picked);
    }
  }

  return points;
}
