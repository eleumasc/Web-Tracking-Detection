import _ from "lodash";
import assert from "assert";
import { applyTransform, TransformToken, TransformTree } from "./TransformTree";
import { countAlphanumChars } from "../../util/countChars";
import { enumerate, toArray } from "iter-tools";

export default function alterTransformTree(
  originalTree: TransformTree
): TransformTree {
  let tree = originalTree;
  let alterableTree: TransformTree | undefined;
  let ttl = 1000;
  while ((alterableTree = findAlterableTree(tree, originalTree))) {
    if (ttl === 0) {
      throw new Error(`Failed alterTransformTree: ${originalTree.token.value}`);
    }
    ttl -= 1;
    const { token: alterableToken } = alterableTree;
    let newTree: TransformTree | undefined;
    let g = alterValue(alterableToken.value);
    let it;
    while (!newTree && !(it = g.next()).done) {
      try {
        newTree = recomputeTree(rebuildValue(it.value, alterableToken), tree);
      } catch (e) {
        if (e instanceof AlterTransformTreeInvariantError) {
          continue;
        }
        throw e;
      }
    }
    if (!newTree) {
      throw new Error(`Unsatisfiable alterValue: ${alterableToken.value}`);
    }
    tree = newTree;
  }
  return tree;
}

function findAlterableTree(
  tree: TransformTree,
  originalTree: TransformTree
): TransformTree | undefined {
  if (tree.token.value === originalTree.token.value) {
    return getHighestRebuildableTree(tree);
  }
  const { children } = tree;
  const { children: originalChildren } = originalTree;
  for (const [i, child] of enumerate(children)) {
    const originalChild = originalChildren[i];
    assert(originalChild);
    const alterableTree = findAlterableTree(child, originalChild);
    if (alterableTree) {
      return alterableTree;
    }
  }
  return undefined;
}

function getHighestRebuildableTree(tree: TransformTree): TransformTree {
  return traverse(tree, 0).tree;

  function traverse(tree: TransformTree, height: number) {
    let result = { tree, height };
    for (const child of tree.children) {
      assert(child.token.input);
      if (!child.token.operation.rebuildRange) {
        continue;
      }
      const subResult = traverse(child, height + 1);
      if (subResult.height > result.height) {
        result = subResult;
      }
    }
    return result;
  }
}

function* alterValue(value: string): Generator<string> {
  const upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowerChars = "abcdefghijklmnopqrstuvwxyz";
  const digitChars = "0123456789";

  const digitMatches = [...value.matchAll(/[0-9]/g)].reverse();
  const upperMatches = [...value.matchAll(/[A-Z]/g)].reverse();
  const lowerMatches = [...value.matchAll(/[a-z]/g)].reverse();

  for (let offset = 1; offset < 26; ++offset) {
    if (offset < 10) {
      for (const match of digitMatches) {
        yield alter(offset, match, digitChars);
      }
    }
    for (const match of upperMatches) {
      yield alter(offset, match, upperChars);
    }
    for (const match of lowerMatches) {
      yield alter(offset, match, lowerChars);
    }
  }

  function alter(offset: number, match: RegExpExecArray, charType: string) {
    const { 0: c, index } = match;
    const d = charType[(charType.indexOf(c) + offset) % charType.length];
    return value.slice(0, index) + d + value.slice(index + 1);
  }
}

function rebuildValue(value: string, token: TransformToken) {
  while (token.input) {
    const { rebuildRange } = token.operation;
    assert(rebuildRange);

    const oldValue = token.input.value;
    let rebuilt: string;
    try {
      rebuilt = rebuildRange(value, token.range.end - token.range.begin);
    } catch (e) {
      throw new AlterTransformTreeInvariantError(
        `Failed rebuildRange: ${String(e)}`
      );
    }
    const newValue =
      oldValue.substring(0, token.range.begin) +
      rebuilt +
      oldValue.substring(token.range.end);
    if (newValue.length !== oldValue.length) {
      throw new AlterTransformTreeInvariantError(
        "newValue and oldValue must have the same length"
      );
    }

    value = newValue;
    token = token.input;
  }
  return value;
}

function recomputeTree(
  initialValue: string,
  refTree: TransformTree
): TransformTree {
  return traverse({ input: null, value: initialValue }, refTree);

  function traverse(
    input: TransformToken,
    { children: oldChildren }: TransformTree
  ): TransformTree {
    const childTokens = _.uniq(
      oldChildren.map(({ token }) => {
        assert(token.input);
        return token.operation;
      })
    ).flatMap((transform) =>
      toArray(applyTransform(transform, input))
    ) as (TransformToken & { input: TransformToken })[];

    const children = oldChildren.map((oldChild) => {
      const { token: oldToken } = oldChild;
      assert(oldToken.input);
      const token = childTokens.find(
        (token) =>
          token.operation === oldToken.operation &&
          _.isEqual(token.range, oldToken.range)
      );
      if (!token) {
        throw new AlterTransformTreeInvariantError(
          "oldToken must have a corresponding token"
        );
      }
      if (
        countAlphanumChars(oldToken.value) !== countAlphanumChars(token.value)
      ) {
        throw new AlterTransformTreeInvariantError(
          "Values of oldToken and token must have the same number of alphanum chars"
        );
      }
      return traverse(token, oldChild);
    });

    return { token: input, children };
  }
}

class AlterTransformTreeInvariantError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = AlterTransformTreeInvariantError.name;
  }
}
