import assert from "assert";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { sliceToken } from "./transforms/slice";
import { Token } from "./Token";
import { TransformTree, traverseTransformTree } from "./TransformTree";

export type SyntacticMatcherMatch = {
  storageToken: Token;
  requestToken: Token;
};

export function syntacticMatcher(
  storageTransformTree: TransformTree,
  requestTransformTree: TransformTree,
): SyntacticMatcherMatch[] {
  const matches: SyntacticMatcherMatch[] = [];

  const isTokenValueMatchable = (token: Token): boolean => {
    const { value } = token;
    return /[\x20-\x7E]{8,}/.test(value) && /[A-Za-z0-9]+/.test(value);
  };

  traverseTransformTree(storageTransformTree, (storageToken) => {
    if (!isTokenValueMatchable(storageToken)) {
      // skip: storageToken is not matchable
      return false;
    }

    let matchFound = false;

    traverseTransformTree(requestTransformTree, (requestToken) => {
      if (!isTokenValueMatchable(requestToken)) {
        // skip: storageToken is not matchable
        return false;
      }

      let index: number;
      if ((index = requestToken.value.indexOf(storageToken.value)) !== -1) {
        matchFound = true;

        if (isIdentifiable(storageToken.value)) {
          // storageToken (identifiable) is substring of requestToken
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
        }

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

  return matches;
}
