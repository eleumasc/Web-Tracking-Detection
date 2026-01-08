import _ from "lodash";
import assert from "assert";

export interface Reducer<TAcc, TVal = any> {
  initialValue(): TAcc;
  reduce(acc: TAcc, value: TVal): TAcc;
}

type ReducerMap = Record<string, Reducer<any, any>>;

type AccumulatorState<M extends ReducerMap> = {
  [K in keyof M]: M[K] extends Reducer<infer TAcc, any> ? TAcc : never;
};

type ReduceInput<M extends ReducerMap> = {
  [K in keyof M]: M[K] extends Reducer<any, infer TIn> ? TIn : never;
};

export class Accumulator<M extends ReducerMap> {
  private readonly reducers: {
    [K in keyof M]: M[K]["reduce"];
  };

  private state: AccumulatorState<M>;

  constructor(definitions: M) {
    this.reducers = {} as any;
    this.state = {} as AccumulatorState<M>;

    for (const key in definitions) {
      const def = definitions[key];
      this.reducers[key] = def.reduce;
      this.state[key] = def.initialValue();
    }
  }

  add<K extends keyof M>(key: K, value: ReduceInput<M>[K]): void {
    const reducer = this.reducers[key];
    this.state[key] = reducer(this.state[key], value);
  }

  addAll(values: Partial<{ [K in keyof M]: ReduceInput<M>[K] }>): void {
    for (const key in values) {
      const k = key as keyof M;
      const value = values[k];
      if (value !== undefined) {
        const reducer = this.reducers[k];
        assert(reducer, `Reducer not found: ${key}`);
        this.state[k] = reducer(this.state[k], value as any);
      }
    }
  }

  get<K extends keyof M>(key: K): AccumulatorState<M>[K] {
    return this.state[key];
  }

  snapshot(): AccumulatorState<M> {
    return { ...this.state };
  }
}

export function createReducer<TAcc, TVal>(
  initialValue: () => TAcc,
  reduce: (acc: TAcc, value: TVal) => TAcc
): Reducer<TAcc, TVal> {
  return { initialValue, reduce };
}

export function createMapReducer<TAcc, TVal, TMappedVal>(
  reducer: Reducer<TAcc, TMappedVal>,
  mapFn: (value: TVal) => TMappedVal
): Reducer<TAcc, TVal> {
  return createReducer(
    () => reducer.initialValue(),
    (acc, value) => reducer.reduce(acc, mapFn(value))
  );
}

export function arrayAdd<T>(): Reducer<T[], T> {
  return createReducer(
    (): T[] => [],
    (acc, value) => [...acc, value]
  );
}

export function arrayConcat<T>(): Reducer<T[], T[]> {
  return createReducer(
    (): T[] => [],
    (acc, value) => [...acc, ...value]
  );
}

export function assign<T>(): Reducer<T | undefined, T | undefined> {
  return createReducer(
    (): T | undefined => undefined,
    (_, value): T | undefined => value
  );
}

export function sum(): Reducer<number, number> {
  return {
    initialValue() {
      return 0;
    },
    reduce(acc, value) {
      return acc + value;
    },
  };
}

export function union<T>(): Reducer<T[], T[]> {
  return createReducer(
    (): T[] => [],
    (acc, value) => _.uniq([...acc, ...value])
  );
}

export function countIf<TVal>(
  predicate: (value: TVal) => boolean
): Reducer<number, TVal> {
  return createMapReducer(sum(), (value) => (predicate(value) ? 1 : 0));
}
