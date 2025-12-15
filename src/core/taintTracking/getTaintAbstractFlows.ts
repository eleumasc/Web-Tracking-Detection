import _ from "lodash";
import assert from "assert";
import Interval from "../../util/Interval";
import { AbstractFlow, AbstractMatch, originFromUrl } from "../AbstractFlow";
import { Cookie, StorageItem } from "../StorageItem";
import { enumerate } from "iter-tools";
import { FoxhoundReport } from "../../foxhound/types";
import { HarReader } from "../../util/HarReader";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { OperationToken } from "../syntacticMatching/Token";
import { Range } from "../../util/Range";
import {
  getTaintFlowsFromFoxhoundReports,
  StorageTaintOperation,
} from "./TaintFlow";

export function getTaintAbstractFlows(
  foxhoundReports: FoxhoundReport[],
  storageItems: StorageItem[],
  harReader: HarReader
): {
  abstractFlows: AbstractFlow[];
} {
  const findSingleStorageItemByTaintOperation = (
    op: StorageTaintOperation
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

  const abstractFlows: AbstractFlow[] = [];
  for (const taintFlow of getTaintFlowsFromFoxhoundReports(foxhoundReports)) {
    const { ranges: taintRanges, sink } = taintFlow;

    if (sink.type !== "Network") continue;
    const { str: requestValue } = taintFlow;
    const { requestUrl } = sink;

    // Consider only taint flows such that there is an HAR entry whose
    // request URL corresponds to that of the network sink.
    // This especially helps to remove taint flows whose network sink do not
    // initiate a network request (e.g., set img.src to data URIs).
    if (!harReader.hasRequestWithUrl(requestUrl)) {
      // console.error(`[Non-Commit TaintFlow] ${requestUrl}`);
      continue;
    }

    const receiverOrigin = originFromUrl(requestUrl);

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
        const displayRange: Range = {
          begin: ranges[0].begin,
          end: ranges[ranges.length - 1].end,
        };
        let checkValue = "";
        let displayValue = "";
        for (const [i, range] of enumerate(ranges)) {
          if (i > 0) {
            displayValue += "|".repeat(range.begin - ranges[i - 1].end);
          }
          const s = (
            target === "Storage" ? storageValue : requestValue
          ).substring(range.begin, range.end);
          checkValue += s;
          displayValue += s;
        }
        return { range: displayRange, checkValue, displayValue };
      };

      const {
        range: storageRange,
        checkValue: storageCheckValue,
        displayValue: storageDisplayValue,
      } = extractValue("Storage");
      if (!isIdentifiable(storageCheckValue)) continue;
      const {
        range: requestRange,
        checkValue: requestCheckValue,
        displayValue: requestDisplayValue,
      } = extractValue("Request");
      if (!isIdentifiable(requestCheckValue)) continue;

      const storageToken: OperationToken = {
        input: {
          input: null,
          value: storageValue,
        },
        operation: "slice",
        range: storageRange,
        value: storageDisplayValue,
      };
      const requestToken: OperationToken = {
        input: {
          input: null,
          value: requestValue,
        },
        operation: "arbitrary",
        range: requestRange,
        value: requestDisplayValue,
      };
      const match: AbstractMatch = { storageToken, requestToken };

      abstractFlows.push({
        storageItem,
        receiverOrigin,
        matches: [match],
      });
    }
  }
  return { abstractFlows };
}
