import _ from "lodash";
import matchIdentifiers from "./chen/matchIdentifiers";
import zxcvbn from "zxcvbn";
import { FoxhoundReport } from "../foxhound/types";
import { HarController } from "../util/HarController";
import { StorageItem } from "./StorageItem";
import { toAggregateFlows } from "./AggregateFlow";
import {
  getSyntacticAbstractFlows,
  getTaintAbstractFlows,
  journeySyntacticMatcher,
} from "./AbstractFlow";

export function processFlows(
  identifiers: StorageItem[],
  foxhoundReports: FoxhoundReport[],
  harController: HarController
) {
  const taintAbstractFlows = getTaintAbstractFlows(
    foxhoundReports,
    identifiers,
    harController
  );
  const syntacticAbstractFlows = getSyntacticAbstractFlows(
    identifiers,
    harController,
    journeySyntacticMatcher
  );

  const taintFlows = toAggregateFlows(taintAbstractFlows);
  const syntacticFlows = toAggregateFlows(syntacticAbstractFlows);

  return {
    taintAbstractFlows,
    syntacticAbstractFlows,
    taintFlows,
    syntacticFlows,
  };
}

export function processIdentifiers(
  auxStorageItems: StorageItem[],
  preStorageItems: StorageItem[]
) {
  const filterStorageItemsUsingZxcvbn = (storageItems: StorageItem[]) =>
    storageItems.filter(
      ({ value }) => value.length >= 128 || zxcvbn(value).guesses_log10 >= 9
    );

  return filterStorageItemsUsingZxcvbn(
    matchIdentifiers(preStorageItems, auxStorageItems)
  );
}
