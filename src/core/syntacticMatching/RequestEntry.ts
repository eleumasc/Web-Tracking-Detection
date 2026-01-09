import { fromJSON, fromQueryValues } from "./Transform";
import { HarReader } from "../../util/HarReader";
import { parseQueryParams } from "../../util/QueryParam";
import { RequestParameter } from "../Flow";
import { toArray } from "iter-tools";

export type RequestEntry = {
  requestParameter: RequestParameter;
  value: string;
  requestUrl: string;
};

type PartialRequestEntry = Pick<RequestEntry, "requestParameter" | "value">;

export function getRequestEntriesFromHar(harReader: HarReader): RequestEntry[] {
  return harReader.entries().flatMap((harEntry) => {
    const {
      request: { url: requestUrl, postData, headers },
    } = harEntry;
    const parsedRequestURL = new URL(requestUrl);

    let requestEntries: RequestEntry[] = [];
    const addRequestEntries = (
      partialRequestEntries: PartialRequestEntry[]
    ) => {
      requestEntries = requestEntries.concat(
        partialRequestEntries.map((partialRequestEntry) => ({
          ...partialRequestEntry,
          requestUrl,
        }))
      );
    };

    addRequestEntries(extractUrlPathSegments(parsedRequestURL.pathname));
    addRequestEntries(extractUrlQueryParams(parsedRequestURL.search));
    if (postData) {
      addRequestEntries(
        extractPostDataComponents(
          harReader.readPostData(postData),
          headers.find(({ name }) => name === "content-type")?.value
        )
      );
    }

    return requestEntries;
  });
}

export function extractUrlPathSegments(input: string): PartialRequestEntry[] {
  return input
    .split("/")
    .slice(1)
    .map(
      (value, index): PartialRequestEntry => ({
        requestParameter: {
          type: "urlPathSegment",
          segmentIndex: index,
        },
        value,
      })
    );
}

export function extractUrlQueryParams(input: string): PartialRequestEntry[] {
  return parseQueryParams(input)
    .filter(({ value }) => value)
    .map(
      ({ key: keyPart, value: valuePart }): PartialRequestEntry => ({
        requestParameter: {
          type: "urlQueryParam",
          paramKey: keyPart.raw,
        },
        value: valuePart!.raw,
      })
    );
}

function extractPostDataComponents(
  input: string,
  contentType?: string
): PartialRequestEntry[] {
  const values = (() => {
    if (contentType?.includes("application/json")) {
      return toArray(fromJSON.transformValue(input)).map((x) => x.value);
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      return toArray(fromQueryValues.transformValue(input)).map((x) => x.value);
    } else {
      return [input];
    }
  })();
  return values.map(
    (value): PartialRequestEntry => ({
      requestParameter: { type: "postData" },
      value,
    })
  );
}
