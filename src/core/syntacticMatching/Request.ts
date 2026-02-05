import { FoxURL } from "../taintTracking/FoxURL";
import { Har } from "../../util/Har";
import { parseJSONValues } from "../../util/JSONValue";
import { parseQueryParams } from "../../util/QueryParam";

export interface Request {
  url: string;
  paramEntries: RequestParamEntry[];
};

export interface RequestParamEntry {
  param: RequestParam;
  value: string;
};

export type RequestParam =
  | {
      type: "urlPathSegment";
      segmentIndex: number;
    }
  | {
      type: "urlQueryParam";
      name: string;
    }
  | { type: "postData" };

export function getRequestsFromHar(har: Har): Request[] {
  return har.entries().map((harEntry): Request => {
    const {
      request: { url, postData, headers },
    } = harEntry;
    const foxUrl = new FoxURL(url);

    let paramEntries: RequestParamEntry[] = [];
    const addParams = (argParams: RequestParamEntry[]): void => {
      paramEntries = paramEntries.concat(
        argParams.filter(({ value }) => value),
      );
    };

    addParams(extractUrlPathSegments(foxUrl.pathname));
    addParams(extractUrlQueryParams(foxUrl.search));
    if (postData) {
      addParams(
        extractPostDataComponents(
          har.readPostData(postData),
          headers.find(({ name }) => name === "content-type")?.value,
        ),
      );
    }

    return { url, paramEntries };
  });
}

export function extractUrlPathSegments(input: string): RequestParamEntry[] {
  return input
    .split("/")
    .slice(1)
    .map(
      (value, index): RequestParamEntry => ({
        param: {
          type: "urlPathSegment",
          segmentIndex: index,
        },
        value,
      }),
    );
}

export function extractUrlQueryParams(input: string): RequestParamEntry[] {
  return parseQueryParams(input)
    .filter(({ value }) => value)
    .map(
      ({ name: namePart, value: valuePart }): RequestParamEntry => ({
        param: {
          type: "urlQueryParam",
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
      param: { type: "postData" },
      value,
    }),
  );
}
