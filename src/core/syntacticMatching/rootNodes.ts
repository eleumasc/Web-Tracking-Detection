import { fromBase64 } from "./transforms/fromBase64";
import { fromJSON } from "./transforms/fromJSON";
import { fromQueryValues } from "./transforms/fromQueryValues";
import { fromUrlEncoding } from "./transforms/fromURLEncoding";
import { MD5 } from "./transforms/MD5";
import { SHA1 } from "./transforms/SHA1";
import { split } from "./transforms/split";
import { toBase64 } from "./transforms/toBase64";
import { toUrlEncoding } from "./transforms/toURLEncoding";
import { TransformTreeEdge, TransformTreeNode } from "./TransformTree";

export function transformStorageValueRootNode(): TransformTreeNode {
  const Decoders = [
    fromJSON,
    fromBase64,
    fromUrlEncoding,
    fromQueryValues,
    split,
  ];
  const Encoders = [toBase64, toUrlEncoding, MD5, SHA1];

  return () => decodeEncodeLayer(3);

  function* decodeEncodeLayer(depth: number): Iterable<TransformTreeEdge> {
    if (depth === 0) return;
    yield* decode(() => decodeEncodeLayer(depth - 1));
    yield* encodeLayer(3);
  }

  function* encodeLayer(depth: number): Iterable<TransformTreeEdge> {
    if (depth === 0) return;
    yield* encode(() => encodeLayer(depth - 1));
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

  function encode(
    child: () => Iterable<TransformTreeEdge>,
  ): Iterable<TransformTreeEdge> {
    return Encoders.map(
      (encoder): TransformTreeEdge => ({
        transformGenerator: encoder,
        child,
      }),
    );
  }
}

export function decodeRequestValueRootNode(): TransformTreeNode {
  const Decoders = [fromBase64, fromUrlEncoding];

  return () => decodeParseLayer(3);

  function* decodeParseLayer(depth: number): Iterable<TransformTreeEdge> {
    if (depth === 0) return;
    yield* decode(() => decodeParseLayer(depth - 1));
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
