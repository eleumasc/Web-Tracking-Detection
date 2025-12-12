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

  const trueAbstractFlows: AbstractFlow[] = [];
  for (const { value: requestValue, receiverOrigin } of requestEntries) {
    traverseTransformTree(
      new DefaultTransformTreeFactory(requestValue, requestValueParseSteps),
      (path) => {
        const { value: requestValue } = path.token;
        for (const { storageItem, canaries } of storageCanariesEntries) {
          for (const canary of canaries) {
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
              requestValue.includes(canary)
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
