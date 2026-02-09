import _ from "lodash";
import assert from "assert";
import { alterValue } from "./alterValue";
import { createStructureTokenArray } from "./StructureTree";
import { enumerate, first, range } from "iter-tools";
import { StorageItem } from "../StorageItem";
import { SyntacticRequest } from "./SyntacticRequest";
import { Token, tokenChain } from "./Token";

export type ModifiedStorageItem = {
  storageItem: StorageItem;
  originalValue: string;
};

type StateEntry = {
  storageItem: StorageItem;
  structureTokenArray: Token[];
  matchTokenArray: Token[];
};

type State = StateEntry[];

export function createModifiedStorageItems(
  syntacticRequests: SyntacticRequest[],
): ModifiedStorageItem[] {
  const storageItems: StorageItem[] = _.uniqWith(
    syntacticRequests.flatMap(({ storageMatches }) =>
      storageMatches.map(({ storageItem }) => storageItem),
    ),
    _.isEqual,
  );

  const originalState: State = storageItems.map(
    (storageItem): StateEntry => ({
      storageItem,
      structureTokenArray: createStructureTokenArray(storageItem.value),
      matchTokenArray: _.uniqWith(
        syntacticRequests
          .flatMap(({ storageMatches }) => storageMatches)
          .filter((storageMatch) =>
            _.isEqual(storageMatch.storageItem, storageItem),
          )
          .flatMap(({ syntacticMatches }) =>
            syntacticMatches.map(({ storageToken }) => storageToken),
          ),
        _.isEqual,
      ),
    }),
  );

  let state = originalState;
  for (const [entryIndex, entry] of enumerate(state)) {
    const originalStorageValue = entry.storageItem.value;
    let storageValue = originalStorageValue;
    const originalStructureTokenArray = entry.structureTokenArray;
    let structureTokenArray = originalStructureTokenArray;
    for (const tokenIndex of range(structureTokenArray.length)) {
      const token = structureTokenArray[tokenIndex];
      if (token.value !== originalStructureTokenArray[tokenIndex].value) {
        continue;
      }

      const newTokenValue = first(alterValue(token.value));
      assert(newTokenValue);

      const newStorageValue = computeReverse(token, newTokenValue);
      const recomputeToken = createRecomputeToken(newStorageValue);
      const newStructureTokenArray = structureTokenArray.map((token) =>
        recomputeToken(token),
      );

      storageValue = newStorageValue;
      structureTokenArray = newStructureTokenArray;
    }

    const newEntry: StateEntry = {
      storageItem: {
        ...entry.storageItem,
        value: storageValue,
      },
      structureTokenArray,
      matchTokenArray: entry.matchTokenArray,
    };

    const newState: State = [...state];
    newState[entryIndex] = newEntry;
    state = newState;
  }

  // TODO: check whether some match token has been modified
  // TODO: review

  return state.map(
    (entry, entryIndex): ModifiedStorageItem => ({
      storageItem: entry.storageItem,
      originalValue: originalState[entryIndex].storageItem.value,
    }),
  );
}

function computeReverse(token: Token, newValue: string): string {
  for (const { transform, chain } of tokenChain(token)) {
    if (!transform) break;
    assert(transform.reverse);
    const originalInput = chain.value;
    try {
      newValue = transform.reverse(newValue, originalInput);
    } catch (e) {
      throw new StateInvariantError(`Failed transform.reverse(): ${String(e)}`);
    }
  }
  return newValue;
}

function createRecomputeToken(newInitialValue: string) {
  const cache = new WeakMap<Token, Token>();

  function recomputeToken(token: Token): Token {
    let newToken = cache.get(token);
    if (!newToken) {
      newToken = doRecomputeToken(token);
      if (newToken.value.length !== token.value.length) {
        throw new StateInvariantError(
          "newValue and value must have the same length",
        );
      }
      cache.set(token, newToken);
    }
    return newToken;
  }

  function doRecomputeToken(token: Token): Token {
    if (!token.chain) {
      return {
        value: newInitialValue,
      };
    }

    const newChain = recomputeToken(token.chain);
    const { transform } = token;
    let newValue: string;
    try {
      newValue = transform.apply(newChain.value);
    } catch (e) {
      throw new StateInvariantError(`Failed transform.apply(): ${String(e)}`);
    }
    return {
      chain: newChain,
      transform,
      value: newValue,
    };
  }

  return recomputeToken;
}

export class StateInvariantError extends Error {
  constructor(message?: string) {
    super(message);
  }
}
