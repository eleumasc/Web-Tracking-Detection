import _ from "lodash";
import { Flow } from "../Flow";
import { getRequestEntriesFromHar } from "./RequestEntry";
import { HarReader } from "../../util/HarReader";
import { requestValueParseSteps } from "./syntacticMatcher";
import { sameCanonicalUrl } from "../CanonicalURL";
import { StorageCanariesEntry } from "./computeCanariesForVerif";
import {
  DefaultTransformTreeFactory,
  traverseTransformTree,
} from "./TransformTree";

export type VerifySyntacticFlowsResult = {
  trueFlows: Flow[];
  fakeFlows: Flow[];
  unknownFlows: Flow[];
};

export function verifySyntacticFlows(
  flows: Flow[],
  storageCanariesEntries: StorageCanariesEntry[],
  verifHarReader: HarReader
) {
  const requestEntries = getRequestEntriesFromHar(verifHarReader);

  let trueFlows: Flow[] = [];
  for (const { value: requestValue, requestUrl } of requestEntries) {
    traverseTransformTree(
      new DefaultTransformTreeFactory(requestValue, requestValueParseSteps),
      (path) => {
        const { value: requestValue } = path.token;
        for (const { storageItem, canaries } of storageCanariesEntries) {
          if (canaries.some((canary) => requestValue.includes(canary))) {
            trueFlows = _.uniq([
              ...trueFlows,
              ...flows.filter(
                (flow) =>
                  _.isEqual(flow.storageItem.id, storageItem.id) &&
                  sameCanonicalUrl(flow.requestUrl, requestUrl)
              ),
            ]);
          }
        }
      }
    );
  }

  const unverifiedFlows = _.difference(flows, trueFlows);

  const verifRequestUrls = verifHarReader
    .entries()
    .map((entry) => entry.request.url);
  const fakeFlows = unverifiedFlows.filter((flow) =>
    verifRequestUrls.some((requestUrl) =>
      sameCanonicalUrl(flow.requestUrl, requestUrl)
    )
  );

  const unknownFlows = _.difference(unverifiedFlows, fakeFlows);

  return {
    trueFlows,
    fakeFlows,
    unknownFlows,
  };
}
