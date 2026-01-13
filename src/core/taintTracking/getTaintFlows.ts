import _ from "lodash";
import assert from "assert";
import Interval from "../../util/Interval";
import { Cookie, StorageItem } from "../StorageItem";
import { enumerate } from "iter-tools";
import { FoxhoundReport } from "../../foxhound/types";
import { HarReader } from "../../util/HarReader";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { Range } from "../../util/Range";
import { TaintFlow } from "../Flow";
import {
  parseFoxhoundReports,
  StorageEnhancedFoxhoundOperation,
} from "./EnhancedFoxhoundFlow";

export function getTaintFlows(
  foxhoundReports: FoxhoundReport[],
  storageItems: StorageItem[],
  harReader: HarReader
): TaintFlow[] {
  const findSingleStorageItemByTaintOperation = (
    op: StorageEnhancedFoxhoundOperation
  ): StorageItem | undefined => {
    const { storageType, key, value, locUrl } = op;
    let foundArray = storageItems.filter(
      ({ id: storageId, value: storageValue }) =>
        storageType === storageId.storageType &&
        key === storageId.key &&
        value === storageValue &&
        ((storageId.storageType === "cookie"
          ? ("." + locUrl.hostname).endsWith(storageId.domain)
          : locUrl.origin === storageId.origin) ||
          locUrl.href === "about:blank") // WARNING!
    );
    if (foundArray.length >= 2 && storageType === "cookie") {
      const maxLengthDomainCookie = _.maxBy(
        foundArray as Cookie[],
        ({ id: { domain } }) => domain.length
      );
      assert(maxLengthDomainCookie);
      foundArray = [maxLengthDomainCookie];
    }
    assert(
      foundArray.length < 2,
      `Expected to find at most one StorageItem, but found ${foundArray.length}`
    );
    return foundArray.length === 1 ? foundArray[0] : undefined;
  };

  const taintFlows: TaintFlow[] = [];
  for (const enhancedFlow of parseFoxhoundReports(foxhoundReports)) {
    const { ranges: taintRanges, sink } = enhancedFlow;

    if (sink.type !== "Network") continue;
    const { str: requestValue } = enhancedFlow;
    const { requestUrl } = sink;

    // Consider only taint flows such that there is an HAR entry whose
    // request URL corresponds to that of the network sink.
    // This especially helps to remove taint flows whose network sink do not
    // initiate a network request (e.g., set img.src to data URIs).
    if (!harReader.hasRequestWithUrl(requestUrl)) {
      // console.error(`[Non-Commit Tainted Flow] ${requestUrl}`);
      continue;
    }

    const individualMatches = [];
    for (const taintRange of taintRanges) {
      if (taintRange.source.type !== "Storage") continue;

      const storageItem = findSingleStorageItemByTaintOperation(
        taintRange.source
      );
      if (!storageItem) continue;

      const {
        begin: requestBegin,
        end: requestEnd,
        source: {
          valueRange: { begin: storageBegin, end: storageEnd },
        },
      } = taintRange;
      individualMatches.push({
        storageItem,
        storageRange: <Range>{ begin: storageBegin, end: storageEnd },
        requestRange: <Range>{ begin: requestBegin, end: requestEnd },
      });
    }

    for (const group of _.values(
      _.groupBy(individualMatches, ({ storageItem: { id } }) =>
        JSON.stringify(id)
      )
    )) {
      const {
        0: { storageItem },
      } = group;
      const { value: storageValue } = storageItem;

      const extractValue = (target: "Storage" | "Request") => {
        const interval = new Interval();
        for (const { begin, end } of group.map(
          target === "Storage" ? (x) => x.storageRange : (x) => x.requestRange
        )) {
          interval.addRange(begin, end);
        }
        const ranges = interval.getRanges();
        const matchRange: Range = {
          begin: ranges[0].begin,
          end: ranges[ranges.length - 1].end,
        };
        let checkValue = "";
        let matchValue = "";
        for (const [i, range] of enumerate(ranges)) {
          if (i > 0) {
            matchValue += "|".repeat(range.begin - ranges[i - 1].end);
          }
          const s = (
            target === "Storage" ? storageValue : requestValue
          ).substring(range.begin, range.end);
          checkValue += s;
          matchValue += s;
        }
        return { range: matchRange, checkValue, matchValue };
      };

      const {
        range: storageRange,
        checkValue: storageCheckValue,
        matchValue: storageMatchValue,
      } = extractValue("Storage");
      if (!isIdentifiable(storageCheckValue)) continue;
      const {
        range: requestRange,
        checkValue: requestCheckValue,
        matchValue: requestMatchValue,
      } = extractValue("Request");
      if (!isIdentifiable(requestCheckValue)) continue;

      taintFlows.push({
        storageItem,
        requestUrl,
        storageValue,
        storageMatch: storageMatchValue,
        storageRange,
        requestValue,
        requestMatch: requestMatchValue,
        requestRange,
      });
    }
  }
  return taintFlows;
}
