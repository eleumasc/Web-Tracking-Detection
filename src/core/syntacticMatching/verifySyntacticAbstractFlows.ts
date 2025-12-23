import _ from "lodash";
import { AbstractFlow } from "../AbstractFlow";
import { getRequestEntriesFromHar } from "./RequestEntry";
import { HarReader } from "../../util/HarReader";
import { requestValueParseSteps } from "./syntacticMatcher";
import { StorageItem } from "../StorageItem";
import {
  DefaultTransformTreeFactory,
  traverseTransformTree,
} from "./TransformTree";

export type StorageCanariesEntry = {
  storageItem: StorageItem;
  canaries: string[];
};

export function verifySyntacticAbstractFlows(
  abstractFlows: AbstractFlow[],
  storageCanariesEntries: StorageCanariesEntry[],
  verifHarReader: HarReader
): AbstractFlow[] {
  const requestEntries = getRequestEntriesFromHar(verifHarReader);

  let trueAbstractFlowSet: AbstractFlow[] = [];
  for (const { value: requestValue, receiverOrigin } of requestEntries) {
    traverseTransformTree(
      new DefaultTransformTreeFactory(requestValue, requestValueParseSteps),
      (path) => {
        const { value: requestValue } = path.token;
        for (const { storageItem, canaries } of storageCanariesEntries) {
          if (canaries.some((canary) => requestValue.includes(canary))) {
            trueAbstractFlowSet = _.uniq([
              ...trueAbstractFlowSet,
              ...abstractFlows.filter(
                (abstractFlow) =>
                  _.isEqual(abstractFlow.storageItem.id, storageItem.id) &&
                  abstractFlow.receiverOrigin === receiverOrigin
              ),
            ]);
          }
        }
      }
    );
  }
  return trueAbstractFlowSet;
}
