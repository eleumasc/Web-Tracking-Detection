import _ from "lodash";
import { AbstractFlow } from "../AbstractFlow";
import { getRequestEntriesFromHar } from "./RequestEntry";
import { HarController } from "../../util/HarController";
import { requestValueParseSteps } from "./syntacticMatcher";
import { StorageItem } from "../StorageItem";
import { StorageTransformTreeEntry } from "./getSyntacticAbstractFlows";
import {
  DefaultTransformTreeFactory,
  TransformTree,
  traverseTransformTree,
} from "./TransformTree";

export type StorageIdentifiablesEntry = {
  storageItem: StorageItem;
  identifiables: string[];
};

export function verifySyntacticAbstractFlows(
  abstractFlows: AbstractFlow[],
  verifStorageIdentifiablesEntries: StorageIdentifiablesEntry[],
  verifHarController: HarController
): AbstractFlow[] {
  const requestEntries = getRequestEntriesFromHar(verifHarController);

  const trueAbstractFlows: AbstractFlow[] = [];
  for (const { value: requestValue, receiverOrigin } of requestEntries) {
    traverseTransformTree(
      new DefaultTransformTreeFactory(requestValue, requestValueParseSteps),
      (path) => {
        const { value: requestValue } = path.token;
        for (const {
          storageItem,
          identifiables: storageValues,
        } of verifStorageIdentifiablesEntries) {
          for (const storageValue of storageValues) {
            const selectedAbstractFlows = _.difference(
              abstractFlows.filter(
                (abstractFlow) =>
                  _.isEqual(abstractFlow.storageItem.id, storageItem.id) &&
                  abstractFlow.receiverOrigin === receiverOrigin
              ),
              trueAbstractFlows
            );
            if (
              selectedAbstractFlows.length > 0 &&
              requestValue.includes(storageValue)
            ) {
              trueAbstractFlows.push(...selectedAbstractFlows);
            }
          }
        }
      }
    );
  }
  return trueAbstractFlows;
}

export function extractStorageIdentifiablesEntries(
  storageTransformTreeEntries: StorageTransformTreeEntry[]
): StorageIdentifiablesEntry[] {
  return storageTransformTreeEntries.flatMap(
    ({ storageItem, transformTree }) => ({
      storageItem,
      identifiables: traverse(transformTree),
    })
  );

  function traverse(tree: TransformTree): string[] {
    if (tree.children.length === 0) {
      return [tree.token.value];
    }
    return _.uniq(tree.children.flatMap((child) => traverse(child)));
  }
}
