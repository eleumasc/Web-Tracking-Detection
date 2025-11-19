import _ from "lodash";
import assert from "assert";
import { AbstractFlow } from "./AbstractFlow";
import { FoxhoundReport } from "../foxhound/types";
import { getStorageItemsFromStorageState, StorageItem } from "./StorageItem";
import { HarController } from "../util/HarController";
import { jsView, StorageState } from "./StorageState";
import { minHittingPoints } from "../util/Range";
import {
  AggregateFlow,
  getAbstractAndAggregateFlows,
} from "../commands/cmdMeasure";

export default function alterStorageStateForVerif(
  auxStorageState: StorageState,
  preStorageState: StorageState,
  taintFoxhoundReports: FoxhoundReport[],
  taintHarController: HarController
): StorageItem[] {
  const auxStorageItems = getStorageItemsFromStorageState(
    jsView(auxStorageState)
  );
  const preStorageItems = getStorageItemsFromStorageState(
    jsView(preStorageState)
  );

  const { syntacticAbstractFlows, taintFlows, syntacticFlows } =
    getAbstractAndAggregateFlows(
      auxStorageItems,
      preStorageItems,
      taintFoxhoundReports,
      taintHarController
    );

  const onlySyntacticFlows = _.differenceWith(
    syntacticFlows,
    taintFlows,
    _.isEqual
  );

  return alterStorageItemsForVerif(syntacticAbstractFlows, onlySyntacticFlows);
}

export function alterStorageItemsForVerif(
  syntacticAbstractFlows: AbstractFlow[],
  onlySyntacticFlows: AggregateFlow[]
): StorageItem[] {
  const alteredStorageItems: StorageItem[] = [];

  const onlySyntacticFlowsStorageIds = _.uniq(
    onlySyntacticFlows.map(({ storageId }) => storageId)
  );
  for (const storageId of onlySyntacticFlowsStorageIds) {
    const groupAbstractFlows = syntacticAbstractFlows.filter((af) =>
      _.isEqual(af.storageItem.id, storageId)
    );

    assert(groupAbstractFlows.length > 0);
    const { storageItem } = groupAbstractFlows[0];
    const { value: storageValue } = storageItem;
    const storageRanges = groupAbstractFlows.flatMap(
      (flow) => flow.storageInterval
    );

    let replaceIndexes: number[];
    try {
      replaceIndexes = minHittingPoints(storageRanges, (x) =>
        /[A-Za-z0-9]/.test(storageValue[x])
      );
    } catch {
      continue;
    }

    let newStorageValue = storageValue;
    for (const index of replaceIndexes) {
      const oldChar = storageValue[index];

      const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const lowerChars = "abcdefghijklmnopqrstuvwxyz";
      const digitChars = "0123456789";
      let charClass;
      if (upperChars.includes(oldChar)) {
        charClass = upperChars;
      } else if (lowerChars.includes(oldChar)) {
        charClass = lowerChars;
      } else {
        charClass = digitChars;
      }

      let newChar;
      do {
        newChar = charClass[Math.floor(Math.random() * charClass.length)];
      } while (newChar === oldChar);

      newStorageValue =
        newStorageValue.slice(0, index) +
        newChar +
        newStorageValue.slice(index + 1);
    }

    alteredStorageItems.push({ ...storageItem, value: newStorageValue });
  }

  return alteredStorageItems;
}
