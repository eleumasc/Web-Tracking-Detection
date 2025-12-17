import { fromJSON, fromQueryValues } from "./Transform";
import { HarReader } from "../../util/HarReader";
import { originFromUrl } from "../AbstractFlow";
import { toArray } from "iter-tools";

export type RequestEntry = {
  param: string;
  value: string;
  receiverOrigin: string;
};

export function getRequestEntriesFromHar(harReader: HarReader): RequestEntry[] {
  return harReader.entries().flatMap((harEntry) => {
    const {
      request: { url: requestUrl, postData, headers },
    } = harEntry;
    const requestURL = new URL(requestUrl);
    const receiverOrigin = originFromUrl(requestURL);

    let requestEntries: RequestEntry[] = [];
    const addRequestEntries = (param: string, values: string[]) => {
      requestEntries = requestEntries.concat(
        values.map((value) => ({
          param,
          value,
          receiverOrigin,
        }))
      );
    };

    addRequestEntries(
      "urlPathname",
      extractUrlPathnameComponents(requestURL.pathname)
    );
    addRequestEntries(
      "urlSearch",
      extractUrlSearchComponents(requestURL.search)
    );
    if (postData) {
      addRequestEntries(
        "postData",
        extractPostDataComponents(
          harReader.readPostData(postData),
          headers.find(({ name }) => name === "content-type")?.value
        )
      );
    }

    return requestEntries;
  });
}

function extractUrlPathnameComponents(input: string): string[] {
  return input.split("/").filter((x) => x);
}

function extractUrlSearchComponents(input: string): string[] {
  return toArray(fromQueryValues.transformValue(input)).map((x) => x.value);
}

function extractPostDataComponents(
  input: string,
  contentType?: string
): string[] {
  if (contentType?.includes("application/json")) {
    return toArray(fromJSON.transformValue(input)).map((x) => x.value);
  } else if (contentType?.includes("application/x-www-form-urlencoded")) {
    return toArray(fromQueryValues.transformValue(input)).map((x) => x.value);
  } else {
    return [input];
  }
}
