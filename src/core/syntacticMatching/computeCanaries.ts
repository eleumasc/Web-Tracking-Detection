import _ from "lodash";
import assert from "assert";
import replaceStringAt from "./Transform";
import { alterValue } from "./alterValue";
import { enumerate, reduce, toArray } from "iter-tools";
import { StorageItem } from "../StorageItem";
import { SyntacticFlow } from "../Flow";
import { Token, tokenChain } from "./Token";

export type StorageCanariesEntry = {
  storageItem: StorageItem;
  canaries: Canary[];
};

export type Canary = {
  modified: string;
  original: string;
};

type StateEntry = {
  storageItem: StorageItem;
  tokens: Token[];
};

type State = StateEntry[];

type AlterStateTarget = {
  entry: StateEntry;
  entryIndex: number;
  token: Token;
  begin: number;
  end: number;
};

export function computeCanaries(
  flows: SyntacticFlow[]
): StorageCanariesEntry[] {
  const storageItems = _.uniqWith(
    flows.map((flow) => flow.storageItem),
    _.isEqual
  );

  const actualOriginalState: State = storageItems.map((storageItem) => {
    return {
      storageItem,
      tokens: _.uniq(
        flows
          .filter((flow) => _.isEqual(flow.storageItem, storageItem))
          .flatMap(({ matches }) => matches.map((match) => match.storageToken))
      ),
    };
  });

  const originalState: State = actualOriginalState.map(
    ({ storageItem, tokens }) => ({
      storageItem,
      tokens: _.uniq(tokens.map((token) => findReversibleToken(token))),
    })
  );
  const originalCanaries = toArray(extractCanaries(originalState));
  let state = originalState;

  // GOAL: no modified canary must include an original canary
  // While there is a non-modified targetCanary
  // We choose the shortest one, which might be included in other canaries
  let targetCanary: string | undefined;
  let it1 = 100;
  while ((targetCanary = findTargetCanary(state, originalCanaries))) {
    if (it1 === 0) {
      throw new Error("findTargetCanary iteration limit reached");
    }
    it1 -= 1;
    // While there is a token whose value includes targetCanary
    const usedNewCanarySet = new Set<string>();
    let alterStateTarget: AlterStateTarget | undefined;
    let it2 = 100;
    alterStateTargetLoop: while (
      (alterStateTarget = findAlterStateTarget(state, targetCanary))
    ) {
      if (it2 === 0) {
        throw new Error("findAlterStateTarget iteration limit reached");
      }
      it2 -= 1;
      // Generate newCanary
      newCanaryLoop: for (const newCanary of alterValue(targetCanary)) {
        if (usedNewCanarySet.has(newCanary)) {
          // Do not reuse newCanary
          continue newCanaryLoop;
        }
        const newValue = computeNewValue(alterStateTarget, newCanary);
        try {
          // Try to alter state
          state = alterState(state, alterStateTarget, newValue);
          // This occurrence of targetCanary has been replaced with newCanary
          // Continue with next alterStateTarget
          usedNewCanarySet.add(newCanary);
          continue alterStateTargetLoop;
        } catch (e) {
          if (e instanceof StateInvariantError) {
            // Try with another newCanary
            continue newCanaryLoop;
          } else {
            // Generic error, abort
            throw e;
          }
        }
      }
      throw new Error("Cannot replace targetCanary with newCanary");
    }
  }

  const actualState: State = state.map((entry, entryIndex): StateEntry => {
    const recomputeToken = createRecomputeToken(entry.storageItem.value);
    return {
      storageItem: entry.storageItem,
      tokens: actualOriginalState[entryIndex].tokens.map((token) =>
        recomputeToken(token)
      ),
    };
  });

  return actualState.map(
    (entry, entryIndex): StorageCanariesEntry => ({
      storageItem: entry.storageItem,
      canaries: _.uniqWith(
        entry.tokens.map(
          (token, tokenIndex): Canary => ({
            modified: token.value,
            original: actualOriginalState[entryIndex].tokens[tokenIndex].value,
          })
        ),
        _.isEqual
      ),
    })
  );
}

function findReversibleToken(token: Token): Token {
  const result = reduce(null, (acc: Token | null, cur: Token) => {
    if (acc) {
      // acc is not null: reset if cur is non-reversible
      if (cur.chain && !cur.transform.reverse) {
        return null;
      } else {
        return acc;
      }
    } else {
      // acc is null: set if cur is reversible
      if (!cur.chain || cur.transform.reverse) {
        return cur;
      } else {
        return null;
      }
    }
  })(tokenChain(token));
  assert(result);
  return result;
}

function* extractCanaries(state: State): Generator<string> {
  for (const entry of state) {
    for (const token of entry.tokens) {
      yield token.value;
    }
  }
}

function findTargetCanary(
  state: State,
  originalCanaries: string[]
): string | undefined {
  const canaries = toArray(extractCanaries(state)).filter((canary) =>
    originalCanaries.includes(canary)
  );
  return _.minBy(canaries, (x) => x.length);
}

function findAlterStateTarget(
  state: State,
  targetCanary: string
): AlterStateTarget | undefined {
  for (const [entryIndex, entry] of enumerate(state)) {
    for (const token of entry.tokens) {
      let index;
      if ((index = token.value.indexOf(targetCanary)) !== -1) {
        return {
          entry,
          entryIndex,
          token,
          begin: index,
          end: index + targetCanary.length,
        };
      }
    }
  }
  return undefined;
}

function computeNewValue(
  { token, begin, end }: AlterStateTarget,
  newCanary: string
) {
  return replaceStringAt(token.value, newCanary, begin, end);
}

function alterState(
  state: State,
  { entry, entryIndex, token }: AlterStateTarget,
  newValue: string
): State {
  const newInitialValue = computeReverse(token, newValue);

  const recomputeToken = createRecomputeToken(newInitialValue);
  const newEntry: StateEntry = {
    storageItem: { ...entry.storageItem, value: newInitialValue },
    tokens: entry.tokens.map((token) => recomputeToken(token)),
  };

  const newState = [...state];
  newState[entryIndex] = newEntry;
  return newState;
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
          "newValue and value must have the same length"
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
