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

export function truncateValuesInOperationToken(token: OperationToken): any {
  const { input, value, ...tokenRest } = token;
  return {
    ...tokenRest,
    input: input && truncateValuesInOperationToken(input),
    value: truncateValue(value),
  };

  function truncateValue(value: string): string {
    return value.substring(0, 500);
  }
}
