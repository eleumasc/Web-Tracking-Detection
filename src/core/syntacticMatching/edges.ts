import { fromBase64 } from "./transforms/fromBase64";
import { fromJSON } from "./transforms/fromJSON";
import { fromQueryValues } from "./transforms/fromQueryValues";
import { fromUrlEncoding } from "./transforms/fromURLEncoding";
import { MD5 } from "./transforms/MD5";
import { SHA1 } from "./transforms/SHA1";
import { split } from "./transforms/split";
import { toBase64 } from "./transforms/toBase64";
import { toUrlEncoding } from "./transforms/toURLEncoding";
import { TransformTreeEdge } from "./TransformTree";

export function transformStorageValueEdges(): Iterable<TransformTreeEdge> {
  const Decoders = [
    split,
    fromBase64,
    fromUrlEncoding,
    fromJSON,
    fromQueryValues,
  ];
  const Encoders = [toBase64, toUrlEncoding, MD5, SHA1];

  return decodeEncodeLayer(3);

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
    childEdges: () => Iterable<TransformTreeEdge>
  ): Iterable<TransformTreeEdge> {
    return Decoders.map((decoder) => ({
      transformType: () => decoder,
      childEdges,
    }));
  }

  function encode(
    childEdges: () => Iterable<TransformTreeEdge>
  ): Iterable<TransformTreeEdge> {
    return Encoders.map((encoder) => ({
      transformType: () => encoder,
      childEdges,
    }));
  }
}

export function parseRequestValueEdges(): Iterable<TransformTreeEdge> {
  const Decoders = [fromBase64, fromUrlEncoding];
  const Parsers = [split, fromJSON, fromQueryValues];

  return decodeParseLayer(3);

  function* decodeParseLayer(depth: number): Iterable<TransformTreeEdge> {
    if (depth === 0) return;
    yield* decode(() => decodeParseLayer(depth - 1));
    yield* parse(() => []);
  }

  function decode(
    childEdges: () => Iterable<TransformTreeEdge>
  ): Iterable<TransformTreeEdge> {
    return Decoders.map((decoder) => ({
      transformType: () => decoder,
      childEdges,
    }));
  }

  function parse(
    childEdges: () => Iterable<TransformTreeEdge>
  ): Iterable<TransformTreeEdge> {
    return Parsers.map((parser) => ({
      transformType: () => parser,
      childEdges,
    }));
  }
}
