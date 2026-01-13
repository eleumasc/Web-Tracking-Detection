import _ from "lodash";
import { Flow } from "./Flow";

export class FlowEquivalence<T> {
  constructor(readonly keyFunction: (flow: Flow) => T) {}

  getAllKeys(flows: Flow[]): T[] {
    return _.uniqWith(
      flows.map((flow) => this.keyFunction(flow)),
      _.isEqual
    );
  }

  filterFlowsByKey<U extends Flow>(key: T, flows: U[]): U[] {
    return flows.filter((flow) => _.isEqual(this.keyFunction(flow), key));
  }
}
