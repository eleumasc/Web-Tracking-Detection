import assert from "assert";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { resolveAmbiguity } from "./resolveAmbiguity";
import { sliceToken } from "./transforms/slice";
import { some } from "iter-tools";
import { Token, tokenChain } from "./Token";
import { TokenGroupTree } from "./TokenGroupTree";
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
  const matchTree = new TokenGroupTree();

  traverseTransformTree(storageTransformTree, (storageToken) => {
    /**
     * // isIdentifiableCheck
     * if (!isIdentifiable(storageToken.value)) {
     *   // skip: storageToken is not identifiable, nor is any derived Token
     *   return false;
     * }
     */

    let matchFound = false;

    traverseTransformTree(requestTransformTree, (requestToken) => {
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
        matchTree.addToken(storageToken);

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

  // resolve ambiguities on matches
  try {
    const selectedStorageTokenArray =
      resolveAmbiguity(matchTree).toTokenArray();
    matches = matches.filter((match) =>
      selectedStorageTokenArray.includes(match.storageToken),
    );
  } catch {
    // if ambiguity cannot be resolved, discard matches
    matches = [];
  }

  return matches;
}
