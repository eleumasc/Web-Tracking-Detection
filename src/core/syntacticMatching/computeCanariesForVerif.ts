import _ from "lodash";
import { enumerate } from "iter-tools";
import { Range } from "../../util/Range";
import { StorageDerivationEntry } from "./getSyntacticFlows";
import { StorageItem } from "../StorageItem";
import { TransformToken, TransformTree } from "./TransformTree";
import {
  AlterTransformTreeInvariantError,
  alterValue,
  recomputeTree,
  reverseValue,
} from "./alterTransformTree";

export type StorageCanariesEntry = {
  storageItem: StorageItem;
  canaries: string[];
};

export function computeCanariesForVerif(
  storageDerivationEntries: StorageDerivationEntry[]
): StorageCanariesEntry[] {
  const originalCanaries = extractQuasiCanaries(storageDerivationEntries);
  let state = storageDerivationEntries;
  let targetCanary;
  let ttlFindTargetCanary = 100;
  while (
    (targetCanary = findTargetCanary(
      extractQuasiCanaries(state),
      originalCanaries
    ))
  ) {
    if (ttlFindTargetCanary === 0) {
      throw new Error(
        `Failed findTargetCanary: ${JSON.stringify({ targetCanary })}`
      );
    }
    ttlFindTargetCanary -= 1;
    let newState = state;
    canaryLoop: for (const newCanary of alterValue(targetCanary)) {
      let alterTargetEntry;
      let ttlFindAlterTargetEntry = 100;
      while (
        (alterTargetEntry = findAlterTargetEntry(newState, targetCanary))
      ) {
        const { stateIndex, storageItem, transformTree, token, range } =
          alterTargetEntry;
        if (ttlFindAlterTargetEntry === 0) {
          throw new Error(
            `Failed findAlterTargetEntry: ${JSON.stringify({
              storageItem,
              targetCanary,
              newCanary,
            })}`
          );
        }
        ttlFindAlterTargetEntry -= 1;
        const { value: targetValue } = token;
        const newValue =
          targetValue.substring(0, range.begin) +
          newCanary +
          targetValue.substring(range.end);
        let newTransformTree;
        try {
          newTransformTree = recomputeTree(
            reverseValue(newValue, token),
            transformTree
          );
        } catch (e) {
          if (e instanceof AlterTransformTreeInvariantError) {
            continue canaryLoop;
          }
          throw e;
        }
        newState = [...newState];
        newState[stateIndex] = {
          storageItem: { ...storageItem, value: newTransformTree.token.value },
          transformTree: newTransformTree,
        };
      }
      break canaryLoop;
    }
    state = newState;
  }
  return mapToStorageCanariesEntries(state);
}

function extractQuasiCanaries(
  storageDerivationEntries: StorageDerivationEntry[]
): string[] {
  return _.uniq(
    storageDerivationEntries.flatMap(({ transformTree }) =>
      extractQuasiCanariesFromTree(transformTree)
    )
  );
}

function extractQuasiCanariesFromTree(transformTree: TransformTree): string[] {
  return traverse(transformTree);

  function traverse(tree: TransformTree): string[] {
    const { token, children } = tree;
    if (children.length === 0) {
      return [token.value];
    }
    let values: string[] = [];
    const reversibleChildren = children.filter((child) =>
      isNodeReversible(child)
    );
    for (const child of reversibleChildren) {
      values = values.concat(traverse(child));
    }
    if (reversibleChildren.length !== children.length) {
      values = values.concat(token.value);
    }
    return _.uniq(values);
  }
}

function isNodeReversible({ token }: TransformTree): boolean {
  return !token.input || Boolean(token.operation.reverseRange);
}

function findTargetCanary(
  canaries: string[],
  originalCanaries: string[]
): string | undefined {
  return canaries.find(
    (canary) =>
      originalCanaries.includes(canary) &&
      !canaries.some(
        (thatCanary) => thatCanary !== canary && canary.includes(thatCanary)
      )
  );
}

type AlterTargetEntry = {
  stateIndex: number;
  storageItem: StorageItem;
  transformTree: TransformTree;
  token: TransformToken;
  range: Range;
};

function findAlterTargetEntry(
  state: StorageDerivationEntry[],
  targetCanary: string
): AlterTargetEntry | undefined {
  type PartialAlterTargetEntry = Pick<AlterTargetEntry, "token" | "range">;

  for (const [stateIndex, { storageItem, transformTree }] of enumerate(state)) {
    const partialEntry = findPartialAlterEntry(transformTree);
    if (partialEntry) {
      return {
        stateIndex,
        storageItem,
        transformTree,
        ...partialEntry,
      };
    }
  }

  function findPartialAlterEntry(
    tree: TransformTree
  ): PartialAlterTargetEntry | undefined {
    const { children } = tree;
    if (children.length === 0) {
      const { token } = tree;
      const index = token.value.indexOf(targetCanary);
      return index !== -1
        ? {
            token,
            range: { begin: index, end: index + targetCanary.length },
          }
        : undefined;
    }
    const reversibleChildren = children.filter((child) =>
      isNodeReversible(child)
    );
    for (const child of reversibleChildren) {
      const partialEntry = findPartialAlterEntry(child);
      if (partialEntry) {
        return partialEntry;
      }
    }
    if (reversibleChildren.length !== children.length) {
      const { token } = tree;
      const index = token.value.indexOf(targetCanary);
      if (index !== -1) {
        return {
          token,
          range: { begin: index, end: index + targetCanary.length },
        };
      }
    }
  }
}

function mapToStorageCanariesEntries(
  storageDerivationEntries: StorageDerivationEntry[]
): StorageCanariesEntry[] {
  return storageDerivationEntries.map(({ storageItem, transformTree }) => ({
    storageItem,
    canaries: extractCanariesFromTree(transformTree),
  }));

  function extractCanariesFromTree(transformTree: TransformTree): string[] {
    return traverse(transformTree);

    function traverse(tree: TransformTree): string[] {
      if (tree.children.length === 0) {
        return [tree.token.value];
      }
      return _.uniq(tree.children.flatMap((child) => traverse(child)));
    }
  }
}
