import _ from "lodash";
import assert from "assert";
import { clusterObjectsBy } from "../util/cluster";
import { RequestTemplate } from "./syntacticMatching/RequestTemplate";
import {
  SyntacticVerifLabel,
  TrackingRequest,
  TrackingSiteEntry,
} from "./TrackingRequest";

export function relabelSyntacticVerif(
  entries: TrackingSiteEntry[]
): TrackingSiteEntry[] {
  const getValueOfSyntacticVerifLabel = (
    label: SyntacticVerifLabel
  ): number => {
    switch (label) {
      case "CONFIRMED":
        return 2;
      case "REFUTED":
        return 1;
      case "UNKNOWN":
        return 0;
      case "NO_MATCHING_REQUESTS":
        return -1;
    }
  };
  const getSyntacticVerifLabelFromValue = (
    labelValue: number
  ): SyntacticVerifLabel => {
    switch (labelValue) {
      case 2:
        return "CONFIRMED";
      case 1:
        return "REFUTED";
      case 0:
        return "UNKNOWN";
      case -1:
        return "NO_MATCHING_REQUESTS";
      default:
        throw new Error(); // This should never happen
    }
  };

  // Cluster requests using origin + fixedUrlPathSegments
  const looseClusters = clusterObjectsBy(
    entries
      .flatMap(({ trackingRequests }) => trackingRequests)
      .filter((request) => request.syntactic)
      .map((request) => ({
        request,
        requestTemplate: RequestTemplate.fromUrlAndHoles(
          request.url,
          request.syntacticHoles!
        ),
      })),
    ({ requestTemplate: { origin, fixedUrlPathSegments } }) => [
      origin,
      fixedUrlPathSegments,
    ]
  );

  // For all loose clusters:
  // 1. compute the union set of param names in holes
  // 2. intersect the param names in each template with the union set
  // 3. re-cluster requests using origin + fixedUrlPathSegments + queryParamNames
  const clusters = looseClusters.flatMap((looseCluster) => {
    const unionQueryParamNamesInHoles = looseCluster
      .flatMap(({ requestTemplate: { holes } }) => holes)
      .filter((hole) => hole.type === "QueryParameter")
      .map((hole) => hole.name)
      .sort();

    return clusterObjectsBy(
      looseCluster.map(({ request, requestTemplate }) => ({
        request,
        requestTemplate,
        queryParamNames: _.intersection(
          unionQueryParamNamesInHoles,
          requestTemplate.queryParamNames
        ),
      })),
      ({ queryParamNames }) => queryParamNames
    );
  });

  // For all clusters, compute the new label and populate a map request-label
  const labelMap = new WeakMap(
    clusters.flatMap((cluster): [TrackingRequest, SyntacticVerifLabel][] => {
      const labelValue = _.max(
        cluster.map(({ request }) =>
          getValueOfSyntacticVerifLabel(request.syntacticVerifLabel!)
        )
      );
      const label =
        labelValue !== undefined
          ? getSyntacticVerifLabelFromValue(labelValue)
          : "NO_MATCHING_REQUESTS";
      return cluster.map(({ request }) => [request, label]);
    })
  );

  return entries.map(
    (entry): TrackingSiteEntry => ({
      ...entry,
      trackingRequests: entry.trackingRequests //
        .map((request): TrackingRequest => {
          if (!request.syntactic) {
            return request;
          }
          const syntacticVerifLabel = labelMap.get(request);
          assert(syntacticVerifLabel);
          return {
            ...request,
            syntacticVerifLabel,
          };
        }),
    })
  );
}
