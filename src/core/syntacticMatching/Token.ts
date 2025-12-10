import { Range } from "../../util/Range";

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

export function removeValuesFromOperationToken(token: OperationToken): any {
  if (!token.input) {
    return { input: null };
  }
  const { input, value, ...tokenRest } = token;
  return {
    ...tokenRest,
    input: removeValuesFromOperationToken(input),
  };
}
