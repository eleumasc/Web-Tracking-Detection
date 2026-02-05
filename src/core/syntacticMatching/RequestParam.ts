import { Entry as HarEntry } from "har-format";
import { FoxURL } from "../../foxhound/FoxURL";
import { Har } from "../../util/Har";
import { parseJSONValues } from "../../util/JSONValue";
import { parseQueryParams } from "../../util/QueryParam";

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

  addParams(extractPathSegments(foxUrl.pathname));
  addParams(extractQueryParameters(foxUrl.search));
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

export function extractPathSegments(input: string): RequestParamEntry[] {
  return input
    .split("/")
    .slice(1)
    .map(
      (value, index): RequestParamEntry => ({
        param: {
          type: "PathSegment",
          segmentIndex: index,
        },
        value,
      }),
    );
}

export function extractQueryParameters(input: string): RequestParamEntry[] {
  return parseQueryParams(input)
    .filter(({ value }) => value)
    .map(
      ({ name: namePart, value: valuePart }): RequestParamEntry => ({
        param: {
          type: "QueryParameter",
          name: namePart.raw,
        },
        value: valuePart!.raw,
      }),
    );
}

export function extractPostDataComponents(
  input: string,
  contentType?: string,
): RequestParamEntry[] {
  const values = (): string[] => {
    if (contentType?.includes("application/json")) {
      return parseJSONValues(input).map(({ cooked: value }) => value);
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      return parseQueryParams(input)
        .filter(({ value }) => value)
        .map(({ value: valuePart }) => valuePart!.raw);
    } else {
      return [input];
    }
  };
  return values().map(
    (value): RequestParamEntry => ({
      param: { type: "PostData" },
      value,
    }),
  );
}
