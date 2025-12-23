import _ from "lodash";
import assert from "assert";
import { applyTransform, TransformToken, TransformTree } from "./TransformTree";
import { toArray } from "iter-tools";

export function* alterValue(value: string): Generator<string> {
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

  function alter(
    offset: number,
    match: RegExpExecArray,
    charType: string
  ): string {
    const { 0: c, index } = match;
    const d = charType[(charType.indexOf(c) + offset) % charType.length];
    return value.slice(0, index) + d + value.slice(index + 1);
  }
}

export function reverseValue(value: string, token: TransformToken) {
  while (token.input) {
    const { reverseRange } = token.operation;
    assert(reverseRange);

    const oldValue = token.input.value;
    let reversed: string;
    try {
      reversed = reverseRange(value, token.range.end - token.range.begin);
    } catch (e) {
      throw new AlterTransformTreeInvariantError(
        `Failed reverseRange: ${String(e)}`
      );
    }
    const newValue =
      oldValue.substring(0, token.range.begin) +
      reversed +
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

export function recomputeTree(
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
      return traverse(token, oldChild);
    });

    return { token: input, children };
  }
}

export class AlterTransformTreeInvariantError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = AlterTransformTreeInvariantError.name;
  }
}
