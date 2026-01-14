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

export type CasesSitesEntry = {
  cases: number;
  sites: number;
};

export function createStatsReducer() {
  return function reduce(stats: Stats, localStats: LocalStats): Stats {
    return _.assignWith(
      { ...stats },
      localStats,
      (acc: any, localValue: LocalStatsValue, key: string) => {
        switch (localValue.type) {
          case "CasesCount": {
            acc ??= { cases: 0, sites: 0 };
            const { cases, sites } = acc as CasesSitesEntry;
            const { value } = localValue;
            return {
              cases: cases + value,
              sites: sites + (value !== 0 ? 1 : 0),
            };
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

function localStatsValueBuilder<T>(builder: (value: T) => LocalStatsValue) {
  return (obj: { [key: string]: T }): LocalStats => {
    return _.mapValues(obj, builder);
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
