import { Range } from "../util/Range";

export type Token<T> =
  | {
      input: null;
      value: string;
    }
  | {
      input: Token<T>;
      operation: T;
      range: Range;
      value: string;
    };

export type OperationToken = Token<string>;

export function truncateTokenValues<T>(token: Token<T>): Token<T> {
  const { input, value, ...tokenRest } = token;
  return {
    ...tokenRest,
    input: input && truncateTokenValues(input),
    value: truncateValue(value),
  } as Token<T>;

  function truncateValue(value: string): string {
    return value.substring(0, 500);
  }
}
