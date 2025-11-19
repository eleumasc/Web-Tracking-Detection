import _ from "lodash";
import { AbstractFlow } from "./AbstractFlow";
import { StorageItem } from "./StorageItem";

export type AggregateFlow = {
  storageId: StorageItem["id"];
  receiverOrigin: string;
};

export function toAggregateFlows(
  abstractFlows: AbstractFlow[]
): AggregateFlow[] {
  return _.uniqWith(
    abstractFlows.map(({ storageItem, receiverOrigin }) => ({
      storageId: storageItem.id,
      receiverOrigin,
    })),
    _.isEqual
  );
}
