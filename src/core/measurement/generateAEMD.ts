import _ from "lodash";
import { ReportRecord } from "./generateReportRecord";

export function generateAEMD(data: ReportRecord): string {
  return `
# Artifact Evaluation

## Table 4
${table4(data)}

## Table 5
${table5(data)}

## Table 6
${table6(data)}

## Table 7
${table7(data)}
`;
}

function formatNumber(num: number, isFloat?: boolean): string {
  const fractionDigits = isFloat ? 2 : 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function table4(data: ReportRecord): string {
  const s = data.statsSyntactic;
  const n = data.statsNonRefutedSyntactic;
  const c = data.statsConfirmedSyntactic;
  const t = data.statsTaint;
  const u = data.statsConfirmedSyntacticUnion;

  const row = (property: (x: typeof s) => number, isFloat?: boolean) =>
    [s, n, c, t, u].map((x) => formatNumber(property(x), isFloat)).join(" | ");

  return `
|  Measure  |  S  |  S-NR  |  S-C  |  T  |  S-C union T  |
| :-------- | :-: | :----: | :---: | :-: | :-----------: |
| Total num of tracking req | ${row((x) => x.totalRequests)} |
| ... In Disconnect | ${row((x) => x.totalRequestsInDisconnect)} |
| Average num of tracking req | ${row((x) => x.avgRequestsPerSite, true)} |
| ... In Disconnect | ${row((x) => x.avgRequestsPerSiteInDisconnect, true)} |
| Total num of trackers | ${row((x) => x.totalTrackers)} |
| ... In Disconnect | ${row((x) => x.totalTrackersInDisconnect)} |
| Average num of trackers | ${row((x) => x.avgTrackersPerSite, true)} |
| ... In Disconnect | ${row((x) => x.avgTrackersPerSiteInDisconnect, true)} |
| N of sites with a tracker | ${row((x) => x.sitesHavingTrackers)} |
| ... In Disconnect | ${row((x) => x.sitesHavingTrackersInDisconnect)} |
`;
}

function table5(data: ReportRecord): string {
  const c = data.statsConfirmedSyntactic;
  const cd = data.statsConfirmedSyntacticAfterDisconnect;
  const t = data.statsTaint;
  const td = data.statsTaintAfterDisconnect;

  const row = (property: (x: typeof c) => number, isFloat?: boolean) =>
    [c, cd, t, td].map((x) => formatNumber(property(x), isFloat)).join(" | ");

  return `
|  Measure  |  S-C  |  --Disconnect  |  T  |  --Disconnect  |
| :-------- | :---: | :------------: | :-: | :------------: |
| Total num of tracking req | ${row((x) => x.totalRequests)} |
| Avg num of tracking req | ${row((x) => x.avgRequestsPerSite, true)} |
| Total num of trackers | ${row((x) => x.totalTrackers)} |
| Avg num of trackers| ${row((x) => x.avgTrackersPerSite, true)} |
| N of sites with a tracker | ${row((x) => x.sitesHavingTrackers)} |
`;
}

function table6(data: ReportRecord): string {
  const s = data.statsSyntactic;
  const n = data.statsNonRefutedSyntactic;
  const c = data.statsConfirmedSyntactic;
  const t = data.statsTaint;

  const row = (i: number) =>
    [s, n, c, t]
      .map((x) => {
        const ranking = x.trackerRankings[i];
        return `${ranking.tracker} | ${formatNumber(ranking.popularity)}`;
      })
      .join(" | ");

  return `
|  S  |  #  |  S-NR  |  #  |  S-C  |  #  |  T  |  #  |
| :-- | :-: | :----- | :-: | :---- | :-: | :-- | :-: |
${_.range(0, 10)
  .map((i) => `| ${row(i)} |`)
  .join("\n")}
`;
}

function table7(data: ReportRecord): string {
  const cd = data.statsConfirmedSyntacticAfterDisconnect;
  const td = data.statsTaintAfterDisconnect;

  const row = (i: number) =>
    [cd, td]
      .map((x) => {
        const ranking = x.trackerRankings[i];
        return `${ranking.tracker} | ${formatNumber(ranking.popularity)}`;
      })
      .join(" | ");

  return `
|  S-C --Disconnect  |  #  |  T --Disconnect  |  #  |
| :----------------- | :-: | :--------------- | :-: |
${_.range(0, 10)
  .map((i) => `| ${row(i)} |`)
  .join("\n")}
`;
}
