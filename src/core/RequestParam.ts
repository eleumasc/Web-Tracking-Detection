import { Entry as HarEntry } from "har-format";
import { FoxURL } from "../foxhound/FoxURL";
import { Har } from "../util/Har";
import { parseJSONValues } from "../util/JSONValue";
import { parsePathSegments } from "../util/PathSegment";
import { parseQueryParams } from "../util/QueryParam";

export type RequestParam =
  | {
      type: "PathSegment";
      segmentIndex: number;
    }
  | {
      type: "QueryParameter";
      name: string;
    }
  | { type: "PostData" };

export interface RequestParamEntry {
  param: RequestParam;
  value: string;
}

export function parseRequestParamEntries(
  harEntry: HarEntry,
  har: Har,
): RequestParamEntry[] {
  const {
    request: { url, postData, headers },
  } = harEntry;
  const foxUrl = new FoxURL(url);

  let paramEntries: RequestParamEntry[] = [];
  const addParams = (argParams: RequestParamEntry[]): void => {
    paramEntries = paramEntries.concat(argParams.filter(({ value }) => value));
  };

  addParams(extractPathSegments(foxUrl));
  addParams(extractQueryParameters(foxUrl));
  if (postData) {
    addParams(
      extractPostDataComponents(
        har.readPostData(postData),
        headers.find(({ name }) => name === "content-type")?.value,
      ),
    );
  }

  return paramEntries;
}

export interface RequestParamEntryWithLoc extends RequestParamEntry {
  begin: number;
  end: number;
}

export function extractPathSegmentsWithLoc(
  foxUrl: FoxURL,
): RequestParamEntryWithLoc[] {
  const { pathnameIdx } = foxUrl.idxes;
  return parsePathSegments(foxUrl.pathname).map(
    (pathSegment): RequestParamEntryWithLoc => {
      const {
        raw: value,
        index: segmentIndex,
        begin: valueBegin,
        end: valueEnd,
      } = pathSegment;
      return {
        param: {
          type: "PathSegment",
          segmentIndex,
        },
        value,
        begin: pathnameIdx + valueBegin,
        end: pathnameIdx + valueEnd,
      };
    },
  );
}

export function extractQueryParametersWithLoc(
  foxUrl: FoxURL,
): RequestParamEntryWithLoc[] {
  const { searchIdx } = foxUrl.idxes;
  return parseQueryParams(foxUrl.search)
    .filter(({ value }) => value)
    .map(({ name: namePart, value: valuePart }): RequestParamEntryWithLoc => {
      const { raw: name } = namePart;
      const { raw: value, begin: valueBegin, end: valueEnd } = valuePart!;
      return {
        param: {
          type: "QueryParameter",
          name,
        },
        value,
        begin: searchIdx + valueBegin,
        end: searchIdx + valueEnd,
      };
    });
}

export function extractPostDataComponentsWithLoc(
  postData: string,
  contentType?: string,
): RequestParamEntryWithLoc[] {
  const values = (): {
    value: string;
    begin: number;
    end: number;
  }[] => {
    if (contentType?.includes("application/json")) {
      return parseJSONValues(postData) //
        .map(({ cooked: value, begin, end }) => ({ value, begin, end }));
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      return parseQueryParams(postData)
        .filter(({ value }) => value)
        .map(({ value: valuePart }) => {
          const { raw: value, begin: valueBegin, end: valueEnd } = valuePart!;
          return { value, begin: valueBegin, end: valueEnd };
        });
    } else {
      return [{ value: postData, begin: 0, end: postData.length }];
    }
  };
  return values().map(
    ({ value, begin, end }): RequestParamEntryWithLoc => ({
      param: { type: "PostData" },
      value,
      begin,
      end,
    }),
  );
}

function withoutLoc(
  entriesWithLoc: RequestParamEntryWithLoc[],
): RequestParamEntry[] {
  return entriesWithLoc.map(({ param, value }) => ({ param, value }));
}

export function extractPathSegments(foxUrl: FoxURL): RequestParamEntry[] {
  return withoutLoc(extractPathSegmentsWithLoc(foxUrl));
}

export function extractQueryParameters(foxUrl: FoxURL): RequestParamEntry[] {
  return withoutLoc(extractQueryParametersWithLoc(foxUrl));
}

export function extractPostDataComponents(
  postData: string,
  contentType?: string,
): RequestParamEntry[] {
  return withoutLoc(extractPostDataComponentsWithLoc(postData, contentType));
}
