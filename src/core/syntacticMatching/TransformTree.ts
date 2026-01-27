import { some } from "iter-tools";
import { Token, tokenChain } from "./Token";
import { TransformGenerator } from "./Transform";

export type TransformTreeNode = () => Iterable<TransformTreeEdge>;

export type TransformTreeEdge = {
  transformGenerator: TransformGenerator;
  child: TransformTreeNode;
};

export class TransformTree {
  protected readonly initialToken: Token;
  protected readonly cache = new WeakMap<
    Token,
    {
      child: TransformTreeNode;
      childToken: Token;
    }[]
  >();

  constructor(
    readonly node: TransformTreeNode,
    readonly initialValue: string,
  ) {
    this.initialToken = {
      value: initialValue,
    };
  }

  traverse() {
    return this.doTraverse(this.node, this.initialToken);
  }

  protected *doTraverse(
    node: TransformTreeNode,
    token: Token,
  ): Generator<Token, any, boolean> {
    const { value: tokenValue, transform: tokenTransform } = token;

    const traverseChildren = yield token;
    if (!traverseChildren) return;

    let cacheEntry = this.cache.get(token);
    if (!cacheEntry) {
      cacheEntry = [];
      for (const { transformGenerator, child } of node()) {
        for (const transform of transformGenerator.generate(
          tokenValue,
          tokenTransform,
        )) {
          let value;
          try {
            value = transform.apply(tokenValue);
          } catch {
            continue;
          }

          // Skip if the new value is an intermediate, meaning that it is
          // possible to find it with a simpler transform
          if (
            some(
              //
              (token: Token) => token.value === value,
            )(tokenChain(token))
          ) {
            continue;
          }

          const childToken: Token = {
            chain: token,
            transform,
            value,
          };
          cacheEntry.push({ child, childToken });
        }
      }
      this.cache.set(token, cacheEntry);
    }

    for (const { child, childToken } of cacheEntry) {
      yield* this.doTraverse(child, childToken);
    }
  }
}

export function traverseTransformTree(
  transformTree: TransformTree,
  visitor: (token: Token) => boolean,
): void {
  const traversal = transformTree.traverse();
  let tokenIt = traversal.next();
  while (!tokenIt.done) {
    const { value: token } = tokenIt;
    const traverseChildren = visitor(token);
    tokenIt = traversal.next(traverseChildren);
  }
}
