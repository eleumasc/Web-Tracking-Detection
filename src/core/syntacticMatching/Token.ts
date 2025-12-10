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
