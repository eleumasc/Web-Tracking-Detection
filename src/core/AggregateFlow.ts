import _ from "lodash";
import { AbstractFlow } from "./AbstractFlow";
import { getSiteByUrl } from "../util/site";

export type AggregateFlow = {
  receiverSite: string;
};

export function toAggregateFlows(
  abstractFlows: AbstractFlow[]
): AggregateFlow[] {
  return _.uniqWith(
    abstractFlows.map((abstractFlow) => toAggregateFlow(abstractFlow)),
    _.isEqual
  );
}

export function toAggregateFlow(abstractFlow: AbstractFlow): AggregateFlow {
  const { receiverOrigin } = abstractFlow;
  return {
    receiverSite: getSiteByUrl(receiverOrigin),
  };
}
