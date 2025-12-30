import assert from "assert";

export interface Reducer<TAcc, TVal> {
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

export function arrayLengthSumCountPair(): Reducer<[number, number], any[]> {
  return {
    initialValue() {
      return [0, 0];
    },
    reduce(acc, value) {
      return [acc[0] + value.length, acc[1] + Number(value.length !== 0)];
    },
  };
}

export function assign<T>(): Reducer<T | undefined, T | undefined> {
  return {
    initialValue() {
      return undefined;
    },
    reduce(_, value) {
      return value;
    },
  };
}

export function nonZeroCount(): Reducer<number, number> {
  return {
    initialValue: () => 0,
    reduce: (acc, value) => acc + Number(value !== 0),
  };
}

export function pairSum(): Reducer<[number, number], [number, number]> {
  return {
    initialValue() {
      return [0, 0];
    },
    reduce(acc, value) {
      return [acc[0] + value[0], acc[1] + value[1]];
    },
  };
}
