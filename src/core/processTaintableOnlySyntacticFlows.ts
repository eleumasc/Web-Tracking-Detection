import _ from "lodash";
import assert from "assert";
import Interval from "../util/Interval";
import { AbstractFlow } from "./AbstractFlow";
import { AggregateFlow, toAggregateFlows } from "./AggregateFlow";
import { leftJoinStorageItemsById, StorageItem } from "./StorageItem";
import {
  flatMap as iterFlatMap,
  range as iterRange,
  toArray,
} from "iter-tools";

export default function processTaintableOnlySyntacticFlows(
  onlySyntacticFlows: AggregateFlow[],
  verifSyntacticAbstractFlows: AbstractFlow[],
  preStorageItems: StorageItem[],
  alteredStorageItems: StorageItem[]
): AggregateFlow[] {
  const replaceIndexesEntries = extractReplaceIndexes(
    alteredStorageItems,
    preStorageItems
  );
  const taintableSyntacticFlows = toAggregateFlows(
    verifSyntacticAbstractFlows.filter((flow) => {
      const replaceIndexesEntry = replaceIndexesEntries.find(({ storageId }) =>
        _.isEqual(storageId, flow.storageItem.id)
      );
      if (!replaceIndexesEntry) {
        return false;
      }
      const { replaceIndexes } = replaceIndexesEntry;
      const storageInterval = Interval.fromRanges(flow.storageInterval);
      return replaceIndexes.some((index) => storageInterval.includes(index));
    })
  );
  return _.intersectionWith(
    onlySyntacticFlows,
    taintableSyntacticFlows,
    _.isEqual
  );
}

function extractReplaceIndexes(
  alteredStorageItems: StorageItem[],
  preStorageItems: StorageItem[]
) {
  const pairs = leftJoinStorageItemsById(alteredStorageItems, preStorageItems);
  return pairs.map(([a, b]) => {
    assert(b !== undefined);
    assert(a.value.length === b.value.length);
    return {
      storageId: a.id,
      replaceIndexes: toArray(
        iterFlatMap(
          (i) => (a.value[i] !== b.value[i] ? [i] : []),
          iterRange(a.value.length)
        )
      ),
    };
  });
}
