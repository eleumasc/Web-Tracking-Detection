import _ from "lodash";
import assert from "assert";
import { inspect } from "util";
import { OperationToken, Token } from "./Token";
import { toArray } from "iter-tools";
import { Transform } from "./Transform";

export type TransformToken = Token<Transform>;

export type TransformTree = {
  token: TransformToken;
  children: TransformTree[];
};

export interface TransformTreePath {
  token: TransformToken;
  skip(): void;
  draw(): void;
  drawChild(token: TransformToken): void;
}

export function traverseTransformTree(
  factory: TransformTreeFactory,
  visitToken: (path: TransformTreePath) => void
): TransformTree | null {
  return traverse(factory.getRootToken(), factory.getInitialSteps());

  function traverse(
    input: TransformToken,
    steps: Iterable<TransformTreeFactoryStep>
  ): TransformTree | null {
    let skipRequired = false;
    let drawRequired = false;
    const children: TransformTree[] = [];
    const path: TransformTreePath = {
      token: input,
      skip() {
        skipRequired = true;
      },
      draw() {
        drawRequired = true;
      },
      drawChild(token) {
        assert(token.input === input);
        children.push({
          token,
          children: [],
        });
      },
    };
    visitToken(path);
    const getResult = (): TransformTree | null =>
      children.length > 0 || drawRequired
        ? {
            token: input,
            children,
          }
        : null;
    if (skipRequired) {
      return getResult();
    }
    for (const step of steps) {
      const nextSteps = step.getNextSteps();
      for (const token of step.execute(input)) {
        assert(token.input === input);
        const child = traverse(token, nextSteps);
        if (child) {
          children.push(child);
        }
      }
    }
    return getResult();
  }
}

export interface TransformTreeFactory {
  getRootToken(): TransformToken;
  getInitialSteps(): Iterable<TransformTreeFactoryStep>;
}

export interface TransformTreeFactoryStep {
  execute(input: TransformToken): Iterable<TransformToken>;
  getNextSteps(): Iterable<TransformTreeFactoryStep>;
}

export class DefaultTransformTreeFactory implements TransformTreeFactory {
  constructor(
    readonly initialValue: string,
    readonly stepsFactory: () => Iterable<TransformTreeFactoryStep>
  ) {}

  getRootToken(): TransformToken {
    return { input: null, value: this.initialValue };
  }

  getInitialSteps(): Iterable<TransformTreeFactoryStep> {
    return this.stepsFactory();
  }
}

export class LazyTransformTreeFactory implements TransformTreeFactory {
  protected rootToken: TransformToken | undefined;
  protected initialSteps: TransformTreeFactoryStep[] | undefined;

  constructor(readonly factory: TransformTreeFactory) {}

  getRootToken(): TransformToken {
    let { rootToken } = this;
    if (!rootToken) {
      rootToken = this.factory.getRootToken();
      this.rootToken = rootToken;
    }
    return rootToken;
  }

  getInitialSteps(): Iterable<TransformTreeFactoryStep> {
    let { initialSteps } = this;
    if (!initialSteps) {
      initialSteps = toArray(this.factory.getInitialSteps()).map(
        (step) => new LazyTransformTreeFactoryStep(step)
      );
      this.initialSteps = initialSteps;
    }
    return initialSteps;
  }
}

class LazyTransformTreeFactoryStep implements TransformTreeFactoryStep {
  protected tokenArrayMap = new WeakMap<TransformToken, TransformToken[]>();
  protected nextSteps: LazyTransformTreeFactoryStep[] | undefined;

  constructor(readonly step: TransformTreeFactoryStep) {}

  execute(input: TransformToken): Iterable<TransformToken> {
    let tokens = this.tokenArrayMap.get(input);
    if (!tokens) {
      tokens = toArray(this.step.execute(input));
      this.tokenArrayMap.set(input, tokens);
    }
    return tokens;
  }

  getNextSteps(): Iterable<TransformTreeFactoryStep> {
    let { nextSteps } = this;
    if (!nextSteps) {
      nextSteps = toArray(this.step.getNextSteps()).map(
        (step) => new LazyTransformTreeFactoryStep(step)
      );
      this.nextSteps = nextSteps;
    }
    return nextSteps;
  }
}

export function* applyTransform(
  transform: Transform,
  input: TransformToken
): Iterable<TransformToken> {
  for (const { value, range } of transform.transformValue(input.value)) {
    yield {
      input,
      operation: transform,
      range,
      value,
    };
  }
}

export function mergeTransformTrees(
  thisTree: TransformTree,
  thatTree: TransformTree
): TransformTree {
  assert(thisTree.token === thatTree.token);
  const { children: thisChildren } = thisTree;
  const { children: thatChildren } = thatTree;
  const onlyThisChildren = _.differenceBy(
    thisChildren,
    thatChildren,
    ({ token }) => token
  );
  const onlyThatChildren = _.differenceBy(
    thatChildren,
    thisChildren,
    ({ token }) => token
  );
  const intersect = _.intersectionBy(
    thisChildren,
    thatChildren,
    ({ token }) => token
  ).map((thisChild) => {
    const { token: thisToken } = thisChild;
    const thatChild = thatChildren.find(
      ({ token: thatToken }) => thatToken === thisToken
    );
    assert(thatChild);
    return mergeTransformTrees(thisChild, thatChild);
  });
  return {
    token: thisTree.token,
    children: [...onlyThisChildren, ...onlyThatChildren, ...intersect],
  };
}

export function toOperationToken(
  transformToken: TransformToken
): OperationToken {
  if (!transformToken.input) {
    return transformToken;
  }
  const { input: oldInput, operation: transform, ...rest } = transformToken;
  const input = toOperationToken(oldInput);
  const operation = transform.name;
  return { input, operation, ...rest };
}

export function dumpTree(tree: TransformTree) {
  console.log(
    inspect(dump(tree), {
      showHidden: false,
      depth: null,
      colors: false,
    })
  );

  function dump(tree: TransformTree): any {
    const { input, ...tokenRest } = tree.token;
    return {
      token: tokenRest,
      children: tree.children.map((child) => dump(child)),
    };
  }
}
