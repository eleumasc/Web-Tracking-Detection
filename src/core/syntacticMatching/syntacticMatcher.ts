import assert from "assert";
import { applyPriority, TokenGroupTree } from "./TokenGroupTree";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { sliceToken } from "./transforms/slice";
import { some } from "iter-tools";
import { Token, tokenChain } from "./Token";
import { TransformTree, traverseTransformTree } from "./TransformTree";

export type SyntacticMatcherMatch = {
  storageToken: Token;
  requestToken: Token;
};

export function syntacticMatcher(
  storageTransformTree: TransformTree,
  requestTransformTree: TransformTree,
): SyntacticMatcherMatch[] {
  let matches: SyntacticMatcherMatch[] = [];
  const storageTokenTree = new TokenGroupTree();

  traverseTransformTree(storageTransformTree, (storageToken) => {
    if (!isValueMatchable(storageToken.value)) {
      // skip: storageToken is not matchable
      return false;
    }

    /**
     * // isIdentifiableCheck
     * if (!isIdentifiable(storageToken.value)) {
     *   // skip: storageToken is not identifiable, nor is any derived Token
     *   return false;
     * }
     */

    let matchFound = false;

    traverseTransformTree(requestTransformTree, (requestToken) => {
      if (!isValueMatchable(requestToken.value)) {
        // skip: requestToken is not matchable
        return false;
      }

      let index: number;
      if ((index = requestToken.value.indexOf(storageToken.value)) !== -1) {
        matchFound = true;

        // this is equivalent to running "isIdentifiableCheck" (see above),
        // but significantly faster
        if (
          some(
            (token: Token) =>
              //
              !isIdentifiable(token.value),
          )(tokenChain(storageToken))
        ) {
          // skip: some Token in chain of storageToken is not identifiable,
          // nor is any derived Token (including storageToken)
          return false;
        }

        const requestSliceToken = sliceToken(
          requestToken,
          index,
          index + storageToken.value.length,
        );
        assert(storageToken.value === requestSliceToken.value);
        matches.push({
          storageToken,
          requestToken: requestSliceToken,
        });
        storageTokenTree.addToken(storageToken);

        // skip: matches involving descendants of requestToken are redundant
        return false;
      } else {
        // continue: a derived Token may yield a match
        return true;
      }
    });

    // continue if no match found, skip otherwise
    return !matchFound;
  });

  // apply priority on syntactic matches
  try {
    const priorityStorageTokenArray =
      applyPriority(storageTokenTree).toTokenArray();
    matches = matches.filter((match) =>
      priorityStorageTokenArray.includes(match.storageToken),
    );
  } catch {
    // in case of ambiguity (the unique type of exception here), discard matches
    matches = [];
  }

  return matches;
}

export function isValueMatchable(value: string): boolean {
  return /[\x20-\x7e]{8,}/.test(value) && /[A-Za-z0-9]+/.test(value);
}
