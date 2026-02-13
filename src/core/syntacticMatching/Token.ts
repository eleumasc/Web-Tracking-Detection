import { Transform } from "./Transform";

export interface BaseToken {
  value: string;
}

export interface RootToken extends BaseToken {
  chain?: undefined;
  transform?: undefined;
}

export interface TransformToken extends BaseToken {
  chain: BaseToken;
  transform: Transform;
}

export type Token = RootToken | TransformToken;

export function* tokenChain(token: Token): IterableIterator<Token> {
  for (let cur: Token | undefined = token; cur; cur = cur.chain) {
    yield cur;
  }
}

export function createTokenTransformChain(token: Token): any[] {
  const transformChain: any[] = [];
  for (let cur: Token = token; cur.transform; cur = cur.chain) {
    transformChain.push({ ...cur.transform });
  }
  return transformChain;
}
