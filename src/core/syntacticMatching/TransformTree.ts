import { some } from "iter-tools";
import { Token, tokenChain } from "./Token";
import { TransformType } from "./Transform";

export type TransformTreeEdge = {
  transformType: () => TransformType;
  childEdges: () => Iterable<TransformTreeEdge>;
};

export class TransformTree {
  protected readonly initialToken: Token;
  protected readonly cache = new WeakMap<
    Token,
    {
      childEdges: () => Iterable<TransformTreeEdge>;
      childToken: Token;
    }[]
  >();

  constructor(
    readonly edges: () => Iterable<TransformTreeEdge>,
    readonly initialValue: string
  ) {
    this.initialToken = {
      value: initialValue,
    };
  }

  traverse() {
    return this.doTraverse(this.edges, this.initialToken);
  }

  protected *doTraverse(
    edges: () => Iterable<TransformTreeEdge>,
    token: Token
  ): Generator<Token, any, boolean> {
    const { value: tokenValue } = token;

    const traverseChildren = yield token;
    if (!traverseChildren) return;

    let cacheEntry = this.cache.get(token);
    if (!cacheEntry) {
      cacheEntry = [];
      for (const { transformType: getTransformType, childEdges } of edges()) {
        const transformType = getTransformType();

        // Skip if this transform trivially inverts the last transform
        // (e.g., `toBase64(fromBase64(x))`)
        const lastTransform = token.transform;
        if (
          transformType.inverts &&
          lastTransform &&
          transformType.inverts(lastTransform)
        ) {
          continue;
        }

        for (const transform of transformType.generateTransforms(tokenValue)) {
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
              (token: Token) => token.value === value
            )(tokenChain(token))
          ) {
            continue;
          }

          const childToken: Token = {
            chain: token,
            transform,
            value,
          };
          cacheEntry.push({ childEdges, childToken });
        }
      }
      this.cache.set(token, cacheEntry);
    }

    for (const { childEdges, childToken } of cacheEntry) {
      yield* this.doTraverse(childEdges, childToken);
    }
  }
}

export function traverseTransformTree(
  transformTree: TransformTree,
  visitor: (token: Token) => boolean
): void {
  const traversal = transformTree.traverse();
  let tokenIt = traversal.next();
  while (!tokenIt.done) {
    const { value: token } = tokenIt;
    const traverseChildren = visitor(token);
    tokenIt = traversal.next(traverseChildren);
  }
}
