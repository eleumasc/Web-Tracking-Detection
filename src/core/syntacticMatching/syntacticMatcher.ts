import assert from "assert";
import { filter, flatMap, pipe } from "iter-tools";
import { OperationToken } from "./Token";
import {
  isIdentifiable,
  isLengthIdentifiable,
} from "../identifierDetection/identifiable";
import {
  DefaultTransformTreeFactory,
  traverseTransformTree,
  LazyTransformTreeFactory,
  TransformTreeFactoryStep,
  applyTransform,
  TransformToken,
  TransformTree,
  toOperationToken,
} from "./TransformTree";
import {
  fromBase64,
  fromJSON,
  fromQueryValues,
  fromURLEncoding,
  MD5,
  SHA1,
  slice,
  split,
  toBase64,
  toURLEncoding,
  Transform,
} from "./Transform";

export type SyntacticMatcher = (requestValue: string) => SyntacticMatcherResult;

export type SyntacticMatcherResult = {
  matches: SyntacticMatch[];
  transformTree: TransformTree | null;
};

export type SyntacticMatch = {
  storageToken: OperationToken;
  requestToken: OperationToken;
};

export function createSyntacticMatcher(storageValue: string): SyntacticMatcher {
  const storageTransformTreeFactory = new LazyTransformTreeFactory(
    new DefaultTransformTreeFactory(storageValue, storageValueTransSteps)
  );

  return (requestValue: string) => {
    if (
      !isLengthIdentifiable(storageValue) ||
      !isLengthIdentifiable(requestValue)
    ) {
      return { matches: [], transformTree: null };
    }

    const requestTransformTreeFactory = new LazyTransformTreeFactory(
      new DefaultTransformTreeFactory(requestValue, requestValueParseSteps)
    );

    const redundantMatchSet = createRedundantMatchSet();

    const matches: SyntacticMatch[] = [];
    const transformTree = traverseTransformTree(
      storageTransformTreeFactory,
      (storagePath) => {
        const { token: storageToken } = storagePath;
        traverseTransformTree(requestTransformTreeFactory, (requestPath) => {
          const { token: requestToken } = requestPath;
          if (redundantMatchSet.has(requestToken, storageToken)) {
            requestPath.skip();
            return;
          }
          let index: number;
          if ((index = requestToken.value.indexOf(storageToken.value)) !== -1) {
            if (isIdentifiable(storageToken.value)) {
              // storageToken (identifier) is substring of requestToken
              const [storageSliceToken] = applyTransform(
                slice(0, storageToken.value.length),
                storageToken
              );
              const [requestSliceToken] = applyTransform(
                slice(index, index + storageToken.value.length),
                requestToken
              );
              assert(storageToken.value === requestSliceToken.value);
              matches.push({
                storageToken: toOperationToken(storageToken),
                requestToken: toOperationToken(requestSliceToken),
              });
              // By using drawChild(storageSliceToken) instead of draw(),
              // every leaf in the transform tree is a matched storage identifier
              storagePath.drawChild(storageSliceToken);
              redundantMatchSet.add(storageToken, requestToken);
              requestPath.skip();
            }
          } else if (
            (index = storageToken.value.indexOf(requestToken.value)) !== -1
          ) {
            if (isIdentifiable(requestToken.value)) {
              // requestToken (identifier) is substring of storageToken
              const [storageSliceToken] = applyTransform(
                slice(index, index + requestToken.value.length),
                storageToken
              );
              assert(storageSliceToken.value === requestToken.value);
              matches.push({
                storageToken: toOperationToken(storageSliceToken),
                requestToken: toOperationToken(requestToken),
              });
              storagePath.drawChild(storageSliceToken);
              redundantMatchSet.add(storageToken, requestToken);
              requestPath.skip();
            }
          }
        });
      }
    );
    return { matches, transformTree };
  };
}

function* distinctValueInInputChain(
  tokens: Iterable<TransformToken>
): IterableIterator<TransformToken> {
  mainLoop: for (const token of tokens) {
    const { value } = token;
    for (let t = token.input; t; t = t.input) {
      if (t.value === value) {
        continue mainLoop;
      }
    }
    yield token;
  }
}

const tokenBarrier = () =>
  pipe(
    filter(({ value }: TransformToken) => isLengthIdentifiable(value)),
    distinctValueInInputChain
  );

export function storageValueTransSteps(): Iterable<TransformTreeFactoryStep> {
  const Decoders = [
    split,
    fromBase64,
    fromURLEncoding,
    fromJSON,
    fromQueryValues,
  ];
  const Encoders = [toBase64, toURLEncoding, MD5, SHA1];

  function decodeStep(
    next: () => Iterable<TransformTreeFactoryStep>
  ): TransformTreeFactoryStep {
    return {
      *execute(input) {
        yield* pipe(
          flatMap((transform: Transform) => applyTransform(transform, input)),
          tokenBarrier()
        )(Decoders);
      },
      getNextSteps() {
        return next();
      },
    };
  }

  function encodeStep(
    next: () => Iterable<TransformTreeFactoryStep>
  ): TransformTreeFactoryStep {
    return {
      *execute(input) {
        yield* pipe(
          flatMap((transform: Transform) => applyTransform(transform, input)),
          tokenBarrier()
        )(Encoders);
      },
      getNextSteps() {
        return next();
      },
    };
  }

  function encodeSteps(depth: number): Iterable<TransformTreeFactoryStep> {
    return depth > 0 ? [encodeStep(() => encodeSteps(depth - 1))] : [];
  }

  function levelSteps(depth: number): Iterable<TransformTreeFactoryStep> {
    return [decodeStep(() => levelSteps(depth - 1)), ...encodeSteps(3)];
  }

  return levelSteps(3);
}

export function requestValueParseSteps(): Iterable<TransformTreeFactoryStep> {
  const Decoders = [fromBase64, fromURLEncoding];
  const Parsers = [split, fromJSON, fromQueryValues];

  function decodeStep(
    next: () => Iterable<TransformTreeFactoryStep>
  ): TransformTreeFactoryStep {
    return {
      *execute(input) {
        yield* pipe(
          flatMap((transform: Transform) => applyTransform(transform, input)),
          tokenBarrier()
        )(Decoders);
      },
      getNextSteps() {
        return next();
      },
    };
  }

  function parseStep(): TransformTreeFactoryStep {
    return {
      *execute(input) {
        yield* pipe(
          flatMap((transform: Transform) => applyTransform(transform, input)),
          tokenBarrier()
        )(Parsers);
      },
      getNextSteps() {
        return [];
      },
    };
  }

  function levelSteps(depth: number): Iterable<TransformTreeFactoryStep> {
    return depth > 0
      ? [decodeStep(() => levelSteps(depth - 1)), parseStep()]
      : [];
  }

  return levelSteps(3);
}

function createRedundantMatchSet() {
  const redundantMatchMap = new WeakMap<
    TransformToken,
    WeakSet<TransformToken>
  >();

  const add = (
    storageToken: TransformToken,
    requestToken: TransformToken
  ): void => {
    let storageTokenSet = redundantMatchMap.get(requestToken);
    if (!storageTokenSet) {
      storageTokenSet = new WeakSet();
      redundantMatchMap.set(requestToken, storageTokenSet);
    }
    storageTokenSet.add(storageToken);
  };

  const has = (
    storageToken: TransformToken,
    requestToken: TransformToken
  ): boolean => {
    const storageTokenSet = redundantMatchMap.get(requestToken);
    if (!storageTokenSet) {
      return false;
    }
    for (let s: TransformToken | null = storageToken; s; s = s.input) {
      if (storageTokenSet.has(s)) {
        return false;
      }
    }
    return true;
  };

  return { add, has };
}
