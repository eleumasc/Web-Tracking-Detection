import { Transform } from "./Transform";

export type Token = {
  value: string;
} & (
  | {
      chain?: undefined;
      transform?: undefined;
    }
  | {
      chain: Token;
      transform: Transform;
    }
);

export function* tokenChain(token: Token): IterableIterator<Token> {
  for (let cur: Token | undefined = token; cur; cur = cur.chain) {
    yield cur;
  }
}

export function viewToken(token: Token): Token {
  const { chain, transform, value } = token;
  return {
    chain: chain && viewToken(chain),
    transform,
    value: truncateValue(value),
  } as Token;

  function truncateValue(value: string): string {
    return value.substring(0, 500);
  }
}
