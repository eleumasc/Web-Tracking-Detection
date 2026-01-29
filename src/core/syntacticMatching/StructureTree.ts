import { applyPriority, TokenGroupTree } from "./TokenGroupTree";
import { fromBase64 } from "./transforms/fromBase64";
import { fromJSON } from "./transforms/fromJSON";
import { fromQueryValues } from "./transforms/fromQueryValues";
import { fromUrlEncoding } from "./transforms/fromURLEncoding";
import { isIdentifiable } from "../identifierDetection/identifiable";
import { isValueMatchable } from "./syntacticMatcher";
import { split } from "./transforms/split";
import { Token } from "./Token";
import {
  TransformTree,
  TransformTreeEdge,
  TransformTreeNode,
  traverseTransformTree,
} from "./TransformTree";

export function createStructureTokenArray(storageValue: string): Token[] {
  const tokenGroupTree = new TokenGroupTree();

  const transformTree = new TransformTree(
    structureTreeRootNode(),
    storageValue,
  );
  traverseTransformTree(transformTree, (token) => {
    const { chain, value } = token;
    if (!chain) {
      tokenGroupTree.addToken(token);
      return true;
    }
    const success = isValueMatchable(value) && isIdentifiable(value);
    if (success) {
      tokenGroupTree.addToken(token);
    }
    return success;
  });

  return applyPriority(tokenGroupTree).toTokenArray();
}

function structureTreeRootNode(): TransformTreeNode {
  const Decoders = [
    split,
    fromBase64,
    fromUrlEncoding,
    fromJSON,
    fromQueryValues,
  ];

  return () => decodeLayer();

  function* decodeLayer(): Iterable<TransformTreeEdge> {
    yield* decode(() => decodeLayer());
  }

  function decode(
    child: () => Iterable<TransformTreeEdge>,
  ): Iterable<TransformTreeEdge> {
    return Decoders.map(
      (decoder): TransformTreeEdge => ({
        transformGenerator: decoder,
        child,
      }),
    );
  }
}
