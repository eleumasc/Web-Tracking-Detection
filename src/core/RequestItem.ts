import { fromJSON } from "./syntacticMatching/transforms/fromJSON";
import { fromQueryValues } from "./syntacticMatching/transforms/fromQueryValues";
import { HarReader } from "../util/HarReader";
import { map, toArray } from "iter-tools";
import { parseQueryParams } from "../util/QueryParam";
import { Transform } from "./syntacticMatching/Transform";

export type RequestItem = {
  url: string;
  params: RequestParameter[];
};

export type RequestParameter = {
  key: RequestParameterKey;
  value: string;
};

export type RequestParameterKey =
  | {
      type: "urlPathSegment";
      segmentIndex: number;
    }
  | {
      type: "urlQueryParam";
      name: string;
    }
  | { type: "postData" };

export function getRequestItemsFromHar(harReader: HarReader): RequestItem[] {
  return harReader.entries().flatMap((harEntry, index) => {
    const {
      request: { url, postData, headers },
    } = harEntry;
    const parsedUrl = new URL(url);

    let params: RequestParameter[] = [];
    params = params.concat(extractUrlPathSegments(parsedUrl.pathname));
    params = params.concat(extractUrlQueryParams(parsedUrl.search));
    if (postData) {
      params = params.concat(
        extractPostDataComponents(
          harReader.readPostData(postData),
          headers.find(({ name }) => name === "content-type")?.value
        )
      );
    }

    return {
      url,
      params,
    };
  });
}

export function extractUrlPathSegments(input: string): RequestParameter[] {
  return input
    .split("/")
    .slice(1)
    .map(
      (value, index): RequestParameter => ({
        key: {
          type: "urlPathSegment",
          segmentIndex: index,
        },
        value,
      })
    );
}

export function extractUrlQueryParams(input: string): RequestParameter[] {
  return parseQueryParams(input)
    .filter(({ value }) => value)
    .map(
      ({ name: namePart, value: valuePart }): RequestParameter => ({
        key: {
          type: "urlQueryParam",
          name: namePart.raw,
        },
        value: valuePart!.raw,
      })
    );
}

export function extractPostDataComponents(
  input: string,
  contentType?: string
): RequestParameter[] {
  const values = (): string[] => {
    if (contentType?.includes("application/json")) {
      return toArray(
        map((transform: Transform) => transform.apply(input))(
          fromJSON.generateTransforms(input)
        )
      );
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      return toArray(
        map((transform: Transform) => transform.apply(input))(
          fromQueryValues.generateTransforms(input)
        )
      );
    } else {
      return [input];
    }
  };
  return values().map(
    (value): RequestParameter => ({
      key: { type: "postData" },
      value,
    })
  );
}
