import _ from "lodash";
import { alterValue } from "./alterValue";
import { Canary } from "./CanaryTree";
import { CanaryTree, CanaryTreeNode, StateInvariantError } from "./CanaryTree";
import { createStructureTree } from "./StructureTree";
import { enumerate } from "iter-tools";
import { StorageItem } from "../StorageItem";
import { SyntacticRequest } from "./SyntacticRequest";

export interface CanaryStorageItem {
  storageItem: StorageItem;
  originalValue: string;
  canaries: Canary[];
  rejectedCanaries: Canary[];
}

type State = StateEntry[];

interface StateEntry {
  storageItem: StorageItem;
  canaryTree: CanaryTree;
}

export function createCanaryStorageItems(
  syntacticRequests: SyntacticRequest[],
): CanaryStorageItem[] {
  const storageItems: StorageItem[] = _.uniqWith(
    syntacticRequests.flatMap(({ storageMatches }) =>
      storageMatches.map(({ storageItem }) => storageItem),
    ),
    _.isEqual,
  );

  const originalState: State = storageItems.map((storageItem): StateEntry => {
    const matchTokenArray = _.uniqWith(
      syntacticRequests
        .flatMap(({ storageMatches }) => storageMatches)
        .filter((storageMatch) =>
          _.isEqual(storageMatch.storageItem, storageItem),
        )
        .flatMap(({ syntacticMatches }) =>
          syntacticMatches.map(({ storageToken }) => storageToken),
        ),
      _.isEqual,
    );
    const structureTree = createStructureTree(storageItem.value);
    const canaryTree = CanaryTree.create(matchTokenArray, structureTree);
    return { storageItem, canaryTree };
  });

  let state = originalState;

  let targetCanary: string | undefined;
  while ((targetCanary = findTargetCanary(state))) {
    const usedNewCanarySet = new Set<string>();

    let alterStateTarget: AlterStateTarget | undefined;
    alterStateTargetLoop: while (
      (alterStateTarget = findAlterStateTarget(state, targetCanary))
    ) {
      const { stateEntry, stateEntryIndex, canaryNode, begin, end } =
        alterStateTarget;
      const { canaryTree } = stateEntry;

      const structureNodes = canaryTree.getStructureTreeLeaves(
        canaryTree.getMatchingStructureTreeNode(canaryNode),
      );

      for (const structureNode of structureNodes) {
        const structureValue = canaryTree.getNodeValue(structureNode);

        for (const newStructureValue of alterValue(structureValue)) {
          let newInitialValue: string;
          let newCanaryTree: CanaryTree;
          try {
            newInitialValue = canaryTree.computeReversed(
              structureNode,
              newStructureValue,
            );
            newCanaryTree = canaryTree.update(newInitialValue);
          } catch (e) {
            if (e instanceof StateInvariantError) {
              continue;
            } else {
              // generic error, abort
              throw e;
            }
          }

          const newCanary = newCanaryTree
            .getNodeValue(canaryNode)
            .substring(begin, end);

          if (newCanary === targetCanary) {
            // modification did not happen, try again
            continue;
          }

          if (usedNewCanarySet.has(newCanary)) {
            // newCanary is already used, try again
            continue;
          }
          usedNewCanarySet.add(newCanary);

          // ok, set state
          {
            const newState = [...state];
            newState[stateEntryIndex] = {
              storageItem: {
                ...stateEntry.storageItem,
                value: newInitialValue,
              },
              canaryTree: newCanaryTree,
            };
            state = newState;
          }

          continue alterStateTargetLoop;
        }
      }

      // fail, reject canaryNode
      {
        const newState = [...state];
        newState[stateEntryIndex] = {
          ...stateEntry,
          canaryTree: canaryTree.rejectCanaryNode(canaryNode),
        };
        state = newState;
      }
    }
  }

  return state.map((entry, entryIndex): CanaryStorageItem => {
    return {
      storageItem: entry.storageItem,
      originalValue: originalState[entryIndex].storageItem.value,
      canaries: entry.canaryTree.getCanaries(),
      rejectedCanaries: entry.canaryTree.getRejectedCanaries(),
    };
  });
}

function findTargetCanary(state: State): string | undefined {
  const targetCanaries = state.flatMap(({ canaryTree }) => {
    const canaryNodes = canaryTree.getCanaryNodes();
    return canaryNodes
      .filter(
        (canaryNode) =>
          canaryTree.getNodeValue(canaryNode) === canaryNode.originalValue,
      )
      .map((canaryNode) => canaryNode.originalValue);
  });
  return _.minBy(targetCanaries, (x) => x.length);
}

interface AlterStateTarget {
  stateEntry: StateEntry;
  stateEntryIndex: number;
  canaryNode: CanaryTreeNode;
  begin: number;
  end: number;
}

function findAlterStateTarget(
  state: State,
  targetCanary: string,
): AlterStateTarget | undefined {
  for (const [stateEntryIndex, stateEntry] of enumerate(state)) {
    const { canaryTree } = stateEntry;
    for (const canaryNode of canaryTree.getCanaryNodes()) {
      let index;
      const value = canaryTree.getNodeValue(canaryNode);
      if ((index = value.indexOf(targetCanary)) !== -1) {
        return {
          stateEntry,
          stateEntryIndex,
          canaryNode,
          begin: index,
          end: index + targetCanary.length,
        };
      }
    }
  }
  return undefined;
}
