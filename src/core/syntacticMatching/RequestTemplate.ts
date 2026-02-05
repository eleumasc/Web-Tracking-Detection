import _ from "lodash";
import assert from "assert";
import { SyntacticFlow } from "../Flow";
import {
  extractPathSegments,
  extractQueryParameters,
  RequestParam,
} from "./RequestParam";

export class RequestTemplate {
  constructor(
    readonly holes: RequestParam[],
    readonly origin: string,
    readonly fixedUrlPathSegments: (string | undefined)[],
    readonly urlQueryParamNames: string[],
  ) {}

  matchesUrl(url: string): boolean {
    const parsedUrl = new URL(url);

    const { origin } = parsedUrl;
    if (origin !== this.origin) {
      return false;
    }

    const urlPathSegments = extractPathSegments(parsedUrl.pathname).map(
      ({ value }) => value,
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

    const urlQueryParamNames = extractQueryParameters(parsedUrl.search).map(
      ({ param: p }) => (assert(p.type === "QueryParameter"), p.name),
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

  includesHole(hole: RequestParam): boolean {
    return this.holes.some((thatHole) => _.isEqual(thatHole, hole));
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
        this.holes.some(
          (hole) => hole.type === "QueryParameter" && hole.name === name,
        )
          ? `${name}=$ID`
          : name,
      )
      .join("&");
    return s;
  }

  static fromSyntacticFlow(flow: SyntacticFlow): RequestTemplate {
    const { requestUrl, matches } = flow;
    const parsedRequestUrl = new URL(requestUrl);

    const { origin } = parsedRequestUrl;

    const holes = _.uniqWith(
      matches.map((match) => match.requestParam),
      _.isEqual,
    );

    const fixedUrlPathSegments = extractPathSegments(
      parsedRequestUrl.pathname,
    ).map(({ param: p, value }) =>
      holes.some((hole) => _.isEqual(hole, p)) ? undefined : value,
    );

    const urlQueryParamNames = extractQueryParameters(parsedRequestUrl.search)
      .map(({ param: p }) => (assert(p.type === "QueryParameter"), p.name))
      .sort();

    return new RequestTemplate(
      holes,
      origin,
      fixedUrlPathSegments,
      urlQueryParamNames,
    );
  }
}
