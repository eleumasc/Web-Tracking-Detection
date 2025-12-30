import _ from "lodash";
import { Flow } from "./Flow";


export class FlowEquivalence<T> {
  constructor(readonly keyFunction: (flow: Flow) => T) { }

  getAllKeys(flows: Flow[]): T[] {
    return _.uniqWith(
      flows.map((flow) => this.keyFunction(flow)),
      _.isEqual
    );
  }

  filterFlowsByKey(key: T, flows: Flow[]): Flow[] {
    return flows.filter((flow) => _.isEqual(this.keyFunction(flow), key));
  }
}
