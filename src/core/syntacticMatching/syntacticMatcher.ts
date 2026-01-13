import assert from "assert";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { sliceToken } from "./transforms/slice";
import { Token, tokenChain } from "./Token";
import { TransformTree, traverseTransformTree } from "./TransformTree";

export type SyntacticMatcherMatch = {
  storageToken: Token;
  requestToken: Token;
};

export function syntacticMatcher(
  storageTransformTree: TransformTree,
  requestTransformTree: TransformTree
): SyntacticMatcherMatch[] {
  const matches: SyntacticMatcherMatch[] = [];

  const isTokenValueMatchable = (token: Token): boolean => {
    const { value } = token;
    return /[\x20-\x7E]{8,}/.test(value) && /[A-Za-z0-9]+/.test(value);
  };

  const redundantMatchSet = new RedundantMatchSet();

  traverseTransformTree(storageTransformTree, (storageToken) => {
    if (!isTokenValueMatchable(storageToken)) {
      // skip: storageToken is not matchable
      return false;
    }

    const isRedundantMatch = redundantMatchSet.createChecker(storageToken);

    traverseTransformTree(requestTransformTree, (requestToken) => {
      if (isRedundantMatch(requestToken)) {
        // skip: a simpler match was already found
        return false;
      }
      if (!isTokenValueMatchable(requestToken)) {
        // skip: storageToken is not matchable
        return false;
      }

      let index: number;
      if ((index = requestToken.value.indexOf(storageToken.value)) !== -1) {
        if (isIdentifiable(storageToken.value)) {
          // storageToken (identifiable) is substring of requestToken
          const requestSliceToken = sliceToken(
            requestToken,
            index,
            index + storageToken.value.length
          );
          assert(storageToken.value === requestSliceToken.value);
          matches.push({
            storageToken,
            requestToken: requestSliceToken,
          });
        }
        redundantMatchSet.add(storageToken, requestToken);

        // skip: matches involving descendants of requestToken are redundant
        return false;
      } else if (
        (index = storageToken.value.indexOf(requestToken.value)) !== -1
      ) {
        if (isIdentifiable(requestToken.value)) {
          // requestToken (identifiable) is substring of storageToken
          const storageSliceToken = sliceToken(
            storageToken,
            index,
            index + requestToken.value.length
          );
          assert(storageSliceToken.value === requestToken.value);
          matches.push({
            storageToken: storageSliceToken,
            requestToken,
          });
        }
        redundantMatchSet.add(storageToken, requestToken);

        // skip: matches involving derivations of requestToken are redundant
        return false;
      } else {
        // continue: a derived Token may yield a match
        return true;
      }
    });

    // continue: traverse the whole storageTransformTree
    return true;
  });

  return matches;
}

class RedundantMatchSet {
  readonly matchMap = new WeakMap<Token, Set<Token>>();

  add(storageToken: Token, requestToken: Token): void {
    let matchRequestTokenSet = this.matchMap.get(storageToken);
    if (!matchRequestTokenSet) {
      matchRequestTokenSet = new Set();
      this.matchMap.set(storageToken, matchRequestTokenSet);
    }
    matchRequestTokenSet.add(requestToken);
  }

  createChecker(storageToken: Token) {
    const requestTokenSet = new Set<Token>();
    for (const chainStorageToken of tokenChain(storageToken)) {
      const matchRequestTokenSet = this.matchMap.get(chainStorageToken);
      if (!matchRequestTokenSet) continue;
      for (const matchRequestToken of matchRequestTokenSet) {
        requestTokenSet.add(matchRequestToken);
      }
    }

    return (requestToken: Token): boolean => requestTokenSet.has(requestToken);
  }
}
