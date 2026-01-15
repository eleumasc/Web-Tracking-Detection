import _ from "lodash";

export type Stats = {
  [key: string]: any;
};

export type LocalStats = {
  [key: string]: LocalStatsValue;
};

export type LocalStatsValue =
  | { type: "CasesCount"; value: number }
  | { type: "SubLocalStats"; value: LocalStats };

export function createStatsReducer() {
  return function reduce(stats: Stats, localStats: LocalStats): Stats {
    return _.assignWith(
      { ...stats },
      localStats,
      (acc: any, localValue: LocalStatsValue, key: string) => {
        switch (localValue.type) {
          case "CasesCount": {
            acc ??= 0;
            const { value } = localValue;
            return acc + value;
          }
          case "SubLocalStats": {
            const { value } = localValue;
            return reduce(acc, value);
          }
        }
      }
    );
  };
}

export function casesCount(cases: any[]): LocalStatsValue {
  return {
    type: "CasesCount",
    value: cases.length,
  };
}

export function subLocalStats(localStats: LocalStats): LocalStatsValue {
  return {
    type: "SubLocalStats",
    value: localStats,
  };
}
