import _ from "lodash";
import { getSyntacticFlows } from "./getSyntacticFlows";
import { Har } from "../../util/Har";
import { map, toArray } from "iter-tools";
import { ModifiedStorageItem } from "./createModifiedStorageItems";
import { RequestParameterKey } from "../RequestItem";
import { RequestTemplate } from "./RequestTemplate";
import { SyntacticFlow } from "../Flow";
import { Token, tokenChain } from "./Token";
import { TrackingIdEquivalence } from "../TrackingRequest";
import { weakMemoize } from "../../util/memoize";

interface AbstractMatch {
  transformChain: any[];
  requestParamKey: RequestParameterKey;
}

export function verifySyntacticTrackingRequests(
  flows: SyntacticFlow[],
  modifiedStorageItems: ModifiedStorageItem[],
  verifHar: Har,
  auxVerifHar: Har,
) {
  const modifiedIdentifiers = modifiedStorageItems.map(
    ({ storageItem }) => storageItem,
  );
  const verifFlows = getSyntacticFlows(modifiedIdentifiers, verifHar);
  const originalIdentifiers = modifiedStorageItems.map(
    ({ storageItem, originalValue }) => ({
      ...storageItem,
      value: originalValue,
    }),
  );
  const auxVerifFlows = getSyntacticFlows(
    originalIdentifiers,
    auxVerifHar,
  );

  const { confirmedFlows, refutedFlows, unknownFlows } = verifySyntacticFlows(
    flows,
    verifFlows,
    auxVerifFlows,
  );

  const allRequests = TrackingIdEquivalence.getAllKeys(flows);
  const confirmedRequests = TrackingIdEquivalence.getAllKeys(confirmedFlows);
  const notConfirmedRequests = _.difference(allRequests, confirmedRequests); // refuted or unknown
  const refutedRequests = _.difference(
    notConfirmedRequests,
    TrackingIdEquivalence.getAllKeys(unknownFlows),
  );
  const unknownRequests = _.difference(notConfirmedRequests, refutedRequests);

  return {
    confirmedFlows,
    refutedFlows,
    unknownFlows,
    confirmedRequests,
    refutedRequests,
    unknownRequests,
  };
}

function verifySyntacticFlows(
  flows: SyntacticFlow[],
  verifFlows: SyntacticFlow[],
  auxVerifFlows: SyntacticFlow[],
) {
  const getAbstractMatches = weakMemoize((flow: SyntacticFlow) =>
    flow.matches.map(
      (match): AbstractMatch => ({
        transformChain: toArray(
          map(
            (x: Token) =>
              //
              x.transform && { ...x.transform },
          )(tokenChain(match.storageToken)),
        ),
        requestParamKey: match.requestParamKey,
      }),
    ),
  );

  const confirmedFlows: SyntacticFlow[] = [];
  const refutedFlows: SyntacticFlow[] = [];
  const unknownFlows: SyntacticFlow[] = [];

  for (const flow of flows) {
    const matchingVerifFlows = getMatchingVerifFlows(flow, verifFlows);
    const matchingAuxVerifFlows = getMatchingVerifFlows(flow, auxVerifFlows);

    if (matchingVerifFlows.length === 0) {
      unknownFlows.push(flow);
    } else if (
      matchingVerifFlows.some(
        (verifFlow) =>
          !_.isEmpty(
            _.intersectionWith(
              getAbstractMatches(verifFlow),
              getAbstractMatches(flow),
              _.isEqual,
            ),
          ),
      )
    ) {
      confirmedFlows.push(flow);
    } else if (
      matchingAuxVerifFlows.every(
        (auxVerifFlow) =>
          !_.isEmpty(
            _.intersectionWith(
              getAbstractMatches(auxVerifFlow),
              getAbstractMatches(flow),
              _.isEqual,
            ),
          ),
      )
    ) {
      refutedFlows.push(flow);
    } else {
      unknownFlows.push(flow);
    }
  }

  return {
    confirmedFlows,
    refutedFlows,
    unknownFlows,
  };
}

function getMatchingVerifFlows(
  flow: SyntacticFlow,
  verifFlows: SyntacticFlow[],
): SyntacticFlow[] {
  const {
    storageItem: { id: storageId },
  } = flow;
  const requestTemplate = RequestTemplate.fromSyntacticFlow(flow);
  return verifFlows.filter((verifFlow) => {
    const {
      storageItem: { id: verifStorageId },
      requestUrl: verifRequestUrl,
    } = verifFlow;
    return (
      _.isEqual(verifStorageId, storageId) &&
      requestTemplate.matchesUrl(verifRequestUrl)
    );
  });
}
