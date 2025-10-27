import _ from "lodash";
import { createHash } from "crypto";
import { Entry as HarEntry } from "har-format";
import { gunzipSync, inflateSync } from "zlib";
import { HarController } from "../util/HarController";
import { parse as parseSearchParams } from "querystring";
import { TaintReport } from "../foxhound/types";
import {
  getAbstractFlowsFromTaintReports,
  StorageOperation,
} from "./AbstractFlow";

export type StorageFlowHistory = StorageFlow[];

export type StorageFlow = {
  itemId: string;
  storageValue: string;
  // senderOrigin: string;
  receiverOrigin: string;
  requestValue: string;
};

export type SyntacticMatcher = (
  requestValue: string
) => (storageValue: string) => boolean;

function originFromUrl(url: string): string {
  return new URL(url).origin;
}

export function getTaintStorageFlowHistory(
  taintReports: TaintReport[],
  harController: HarController
): StorageFlowHistory {
  const history: StorageFlowHistory = [];
  for (const flow of getAbstractFlowsFromTaintReports(taintReports)) {
    const { sources, sink } = flow;

    if (!(sink.type === "Network")) continue;
    const { str: requestValue } = flow;
    const { location, requestUrl } = sink;

    // Consider only taint flows such that there is an HAR entry whose
    // request URL corresponds to that of the network sink.
    // This especially helps to remove taint flows whose network sink do not
    // initiate a network request (e.g., set img.src to data URIs).
    if (!harController.hasRequestWithUrl(requestUrl)) {
      console.log(requestUrl);
      continue;
    }

    // const senderOrigin = originFromUrl(location);
    const receiverUrl = requestUrl;
    const receiverOrigin = originFromUrl(receiverUrl);

    for (const { itemId, value: storageValue } of sources.filter(
      (source) => source.type === "Storage"
    )) {
      history.push({
        itemId,
        storageValue,
        // senderOrigin,
        receiverOrigin,
        requestValue,
      });
    }
  }
  return history;
}

export function getSyntacticStorageFlowHistory(
  storageOperations: StorageOperation[],
  harController: HarController,
  syntacticMatch: SyntacticMatcher
): StorageFlowHistory {
  const history: StorageFlowHistory = [];
  const storageOperationGroups = _.toPairs(
    _.mapValues(
      _.groupBy(storageOperations, ({ value }) => value),
      (valueGroup) =>
        _.values(_.groupBy(valueGroup, ({ itemId }) => itemId)).map(
          // minBy because we consider the first moment when value is assigned to that storage item
          (itemIdGroup) => _.minBy(itemIdGroup, ({ timestamp }) => timestamp)!
        )
    )
  );
  for (const harEntry of harController.entries()) {
    const {
      request: { url: requestUrl, postData },
    } = harEntry;
    const requestURL = new URL(requestUrl);

    // const initiator = headers.find(({ name }) => name === "X-Initiator")?.value;
    // if (!initiator) continue;

    // const senderOrigin = originFromUrl(initiator);
    const receiverUrl = requestUrl;
    const receiverOrigin = originFromUrl(receiverUrl);

    const requestValueMatchers = [
      requestURL.pathname,
      requestURL.search,
      ...(postData ? [harController.readPostData(postData)] : []),
    ].map((requestValue) => ({
      value: requestValue,
      matcher: syntacticMatch(requestValue),
    }));

    for (const [storageValue, storageValueGroup] of storageOperationGroups) {
      const match = requestValueMatchers.find(({ matcher }) =>
        matcher(storageValue)
      );
      if (!match) continue;
      const { value: requestValue } = match;
      for (const { itemId, value: storageValue } of storageValueGroup) {
        history.push({
          itemId,
          storageValue,
          // senderOrigin,
          receiverOrigin,
          requestValue,
        });
      }
    }
  }
  return history;
}

export const syntacticMatchJourney: SyntacticMatcher = (
  requestValue: string
) => {
  type Decoder = (value: string) => string[];

  const decodeURLEncoding: Decoder = (value) => {
    try {
      const decoded = decodeURIComponent(value);
      return decoded !== value ? [decoded] : [];
    } catch {
      return [];
    }
  };
  const decodeJSON: Decoder = (value) => {
    let jsRootValue;
    try {
      jsRootValue = JSON.parse(value);
    } catch {
      return [];
    }
    return (function extractStringValues(jsValue): string[] {
      switch (typeof jsValue) {
        case "string": {
          return [jsValue];
        }
        case "object": {
          if (!jsValue) {
            return [];
          }
          if (Array.isArray(jsValue)) {
            return jsValue.flatMap((x) => extractStringValues(x));
          }
          return Object.values(jsValue).flatMap((x) => extractStringValues(x));
        }
        default:
          return [];
      }
    })(jsRootValue);
  };
  const decodeBase64: Decoder = (value) => {
    if (value.length % 4 !== 0 || !/^[A-Za-z0-9+\/\-_]+={0,2}$/.test(value)) {
      return [];
    }
    return [Buffer.from(value, "base64").toString()];
  };
  const decodeGzip: Decoder = (value) => {
    try {
      return [gunzipSync(Buffer.from(value)).toString()];
    } catch {
      return [];
    }
  };
  const decodeDeflate: Decoder = (value) => {
    try {
      return [inflateSync(Buffer.from(value)).toString()];
    } catch {
      return [];
    }
  };
  const decodeSearchParams: Decoder = (value) => {
    return Object.values(
      parseSearchParams(value, undefined, undefined, {
        decodeURIComponent: (x) => x,
      })
    ).flatMap((values) => values ?? []);
  };
  function* generateCandidateRequestValues(
    initialValue: string
  ): Generator<string> {
    const MAX_ITERATION: number = 1000;
    const queue: string[] = [initialValue];
    let value: string | undefined;
    let iteration: number = 0;
    while (
      iteration < MAX_ITERATION &&
      ((value = queue.shift()), value !== undefined)
    ) {
      iteration += 1;
      if (value.length < 5) continue;
      yield value;
      for (const decoder of [
        decodeURLEncoding,
        decodeJSON,
        decodeBase64,
        // decodeGzip,
        // decodeDeflate,
        decodeSearchParams,
      ]) {
        const newValues = decoder(value).filter((x) => x.length > 0);
        queue.push(...newValues);
      }
    }
  }

  const requestValues = [...generateCandidateRequestValues(requestValue)];

  return (storageValue: string) => {
    return requestValues.some((requestValue) => {
      return (
        requestValue.includes(storageValue) ||
        storageValue.includes(requestValue)
      );
    });
  };
};

export const syntacticMatchCookieguard: SyntacticMatcher = (
  requestValue: string
) => {
  return (storageValue: string) => {
    const tokens = storageValue
      .split(/[^A-Za-z0-9]/)
      .filter((x) => x.length >= 8);

    const doesQueryIncludeSomeToken = (
      encoder?: (value: string) => string
    ): boolean =>
      tokens.some((t) => requestValue.includes(encoder ? encoder(t) : t));

    return (
      doesQueryIncludeSomeToken() ||
      doesQueryIncludeSomeToken((t) => Buffer.from(t).toString("base64")) ||
      doesQueryIncludeSomeToken((t) =>
        createHash("md5").update(t).digest("hex")
      ) ||
      doesQueryIncludeSomeToken((t) =>
        createHash("sha1").update(t).digest("hex")
      )
    );
  };
};
