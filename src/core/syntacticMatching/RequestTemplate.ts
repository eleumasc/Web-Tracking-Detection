import _ from "lodash";
import assert from "assert";
import { FoxURL } from "../../foxhound/FoxURL";
import { SyntacticRequest } from "./SyntacticRequest";
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
    const foxUrl = new FoxURL(url);

    const { origin } = foxUrl;
    if (origin !== this.origin) {
      return false;
    }

    const urlPathSegments = extractPathSegments(foxUrl.pathname).map(
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

    const urlQueryParamNames = extractQueryParameters(foxUrl.search).map(
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

  static fromSyntacticRequest(request: SyntacticRequest): RequestTemplate {
    const { url, storageMatches } = request;
    const foxUrl = new FoxURL(url);

    const { origin } = foxUrl;

    const holes = _.uniqWith(
      storageMatches.flatMap(({ syntacticMatches }) =>
        syntacticMatches.map(({ requestParam }) => requestParam),
      ),
      _.isEqual,
    );

    const fixedUrlPathSegments = extractPathSegments(foxUrl.pathname).map(
      ({ param: p, value }) =>
        holes.some((hole) => _.isEqual(hole, p)) ? undefined : value,
    );

    const urlQueryParamNames = extractQueryParameters(foxUrl.search)
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
