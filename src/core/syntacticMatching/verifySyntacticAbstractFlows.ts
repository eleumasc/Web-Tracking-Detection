import _ from "lodash";
import { AbstractFlow } from "../AbstractFlow";
import { getRequestEntriesFromHar } from "./RequestEntry";
import { HarReader } from "../../util/HarReader";
import { requestValueParseSteps } from "./syntacticMatcher";
import { StorageItem } from "../StorageItem";
import { StorageTransformTreeEntry } from "./getSyntacticAbstractFlows";
import {
  DefaultTransformTreeFactory,
  TransformTree,
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

  let trueAbstractFlowSet = new Set<AbstractFlow>();
  for (const { value: requestValue, receiverOrigin } of requestEntries) {
    traverseTransformTree(
      new DefaultTransformTreeFactory(requestValue, requestValueParseSteps),
      (path) => {
        const { value: requestValue } = path.token;
        for (const { storageItem, canaries } of storageCanariesEntries) {
          if (canaries.some((canary) => requestValue.includes(canary))) {
            trueAbstractFlowSet = new Set([
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
  return [...trueAbstractFlowSet];
}

export function extractStorageCanariesEntries(
  storageTransformTreeEntries: StorageTransformTreeEntry[]
): StorageCanariesEntry[] {
  return storageTransformTreeEntries.flatMap(
    ({ storageItem, transformTree }) => ({
      storageItem,
      canaries: traverse(transformTree),
    })
  );

  function traverse(tree: TransformTree): string[] {
    if (tree.children.length === 0) {
      return [tree.token.value];
    }
    return _.uniq(tree.children.flatMap((child) => traverse(child)));
  }
}
