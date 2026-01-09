import _ from "lodash";
import assert from "assert";
import { Flow, RequestParameter } from "../Flow";
import { HarReader } from "../../util/HarReader";
import { requestValueParseSteps } from "./syntacticMatcher";
import { StorageCanariesEntry } from "./computeCanariesForVerif";
import {
  extractUrlPathSegments,
  extractUrlQueryParams,
  getRequestEntriesFromHar,
} from "./RequestEntry";
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
  const trueFlows: Flow[] = [];
  const fakeFlows: Flow[] = [];
  const unknownFlows: Flow[] = [];

  const requestEntries = getRequestEntriesFromHar(verifHarReader);

  const transformedValuesCache = new Map<string, string[]>();
  const getTransformedValuesForRequestValue = (
    requestValue: string
  ): string[] => {
    let transformedValues = transformedValuesCache.get(requestValue);
    if (transformedValues) {
      return transformedValues;
    }
    transformedValues = [];
    traverseTransformTree(
      new DefaultTransformTreeFactory(requestValue, requestValueParseSteps),
      (path) => {
        transformedValues.push(path.token.value);
      }
    );
    transformedValuesCache.set(requestValue, transformedValues);
    return transformedValues;
  };

  for (const flow of flows) {
    const { storageItem } = flow;
    const canaries = storageCanariesEntries.find((entry) =>
      _.isEqual(entry.storageItem.id, storageItem.id)
    )?.canaries;
    assert(canaries);

    let requestFound = false;
    let verified = false;

    const urlTemplate = URLTemplate.from(flow);
    for (const entry of verifHarReader.entries()) {
      const requestUrl = entry.request.url;
      if (urlTemplate.fits(requestUrl)) {
        requestFound = true;
      } else {
        continue;
      }
      const placeholders = urlTemplate.getPlaceholders();
      const placeholderRequestEntries = requestEntries.filter(
        (requestEntry) =>
          requestEntry.requestUrl === requestUrl &&
          placeholders.some((placeholder) =>
            _.isEqual(requestEntry.requestParameter, placeholder)
          )
      );
      if (
        placeholderRequestEntries.some((requestEntry) =>
          getTransformedValuesForRequestValue(requestEntry.value).some(
            (requestValue) =>
              canaries.some((canary) => requestValue.includes(canary))
          )
        )
      ) {
        verified = true;
        break;
      }
    }

    if (verified) {
      trueFlows.push(flow);
    } else if (requestFound) {
      fakeFlows.push(flow);
    } else {
      unknownFlows.push(flow);
    }
  }

  return {
    trueFlows,
    fakeFlows,
    unknownFlows,
  };
}

class URLTemplate {
  constructor(
    readonly origin: string,
    readonly placeholders: RequestParameter[],
    readonly fixedUrlPathSegments: (string | undefined)[],
    readonly urlQueryParamKeys: string[]
  ) {}

  fits(url: string): boolean {
    const parsedUrl = new URL(url);

    const { origin } = parsedUrl;
    if (origin !== this.origin) {
      return false;
    }

    const urlPathSegments = extractUrlPathSegments(parsedUrl.pathname).map(
      ({ value }) => value
    );
    if (urlPathSegments.length !== this.fixedUrlPathSegments.length) {
      return false;
    }
    if (
      !urlPathSegments.every((segment, index) => {
        const thisSegment = this.fixedUrlPathSegments[index];
        return thisSegment === undefined || segment === thisSegment;
      })
    ) {
      return false;
    }

    const urlQueryParamKeys = extractUrlQueryParams(parsedUrl.search).map(
      ({ requestParameter }) => (
        assert(requestParameter.type === "urlQueryParam"),
        requestParameter.paramKey
      )
    );
    if (urlQueryParamKeys.length !== this.urlQueryParamKeys.length) {
      return false;
    }
    if (
      _.intersection(urlQueryParamKeys, this.urlQueryParamKeys).length !==
      this.urlQueryParamKeys.length
    ) {
      return false;
    }

    return true;
  }

  getPlaceholders(): RequestParameter[] {
    return [...this.placeholders];
  }

  static from(flow: Flow): URLTemplate {
    const { requestUrl, matches } = flow;
    const parsedRequestUrl = new URL(requestUrl);

    const { origin } = parsedRequestUrl;

    const placeholders = _.uniqWith(
      matches.map((match) => match.requestParameter),
      _.isEqual
    );

    const fixedUrlPathSegments = extractUrlPathSegments(
      parsedRequestUrl.pathname
    ).map(({ requestParameter, value }) =>
      placeholders.some((placeholder) =>
        _.isEqual(placeholder, requestParameter)
      )
        ? undefined
        : value
    );

    const urlQueryParamKeys = extractUrlQueryParams(
      parsedRequestUrl.search
    ).map(
      ({ requestParameter }) => (
        assert(requestParameter.type === "urlQueryParam"),
        requestParameter.paramKey
      )
    );

    return new URLTemplate(
      origin,
      placeholders,
      fixedUrlPathSegments,
      urlQueryParamKeys
    );
  }
}
