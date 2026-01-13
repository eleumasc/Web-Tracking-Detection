import _ from "lodash";
import assert from "assert";
import { SyntacticFlow } from "../Flow";
import {
  extractUrlPathSegments,
  extractUrlQueryParams,
  RequestParameterKey,
} from "../RequestItem";

export class URLTemplate {
  constructor(
    readonly origin: string,
    readonly placeholders: RequestParameterKey[],
    readonly fixedUrlPathSegments: (string | undefined)[],
    readonly urlQueryParamNames: string[]
  ) {}

  getPlaceholders(): RequestParameterKey[] {
    return [...this.placeholders];
  }

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

    const urlQueryParamNames = extractUrlQueryParams(parsedUrl.search).map(
      ({ key }) => (assert(key.type === "urlQueryParam"), key.name)
    );
    if (urlQueryParamNames.length !== this.urlQueryParamNames.length) {
      return false;
    }
    if (
      _.intersection(urlQueryParamNames, this.urlQueryParamNames).length !==
      this.urlQueryParamNames.length
    ) {
      return false;
    }

    return true;
  }

  static fromSyntacticFlow(flow: SyntacticFlow): URLTemplate {
    const { requestUrl, matches } = flow;
    const parsedRequestUrl = new URL(requestUrl);

    const { origin } = parsedRequestUrl;

    const placeholders = _.uniqWith(
      matches.map((match) => match.requestParamKey),
      _.isEqual
    );

    const fixedUrlPathSegments = extractUrlPathSegments(
      parsedRequestUrl.pathname
    ).map(({ key, value }) =>
      placeholders.some((placeholder) => _.isEqual(placeholder, key))
        ? undefined
        : value
    );

    const urlQueryParamNames = extractUrlQueryParams(
      parsedRequestUrl.search
    ).map(({ key }) => (assert(key.type === "urlQueryParam"), key.name));

    return new URLTemplate(
      origin,
      placeholders,
      fixedUrlPathSegments,
      urlQueryParamNames
    );
  }

  toString() {
    let s = "";
    s += this.origin;
    s += "/";
    s += this.fixedUrlPathSegments
      .map((x) => (x !== undefined ? x : "$ID"))
      .join("/");
    s += "?";
    s += this.urlQueryParamNames
      .map((name) =>
        this.placeholders.some(
          (placeholder) =>
            placeholder.type === "urlQueryParam" && placeholder.name === name
        )
          ? `${name}=$ID`
          : name
      )
      .join("&");
    return s;
  }
}
