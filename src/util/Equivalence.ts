import _ from "lodash";

export class Equivalence<K, V> {
  constructor(readonly keyFunction: (value: V) => K) {}

  getAllKeys(values: V[]): K[] {
    return _.uniqWith(
      values.map((value) => this.keyFunction(value)),
      _.isEqual
    );
  }

  filterValuesByKey<U extends V>(key: K, values: U[]): U[] {
    return values.filter((value) => _.isEqual(this.keyFunction(value), key));
  }
}
