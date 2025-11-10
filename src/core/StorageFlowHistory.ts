import _ from "lodash";
import { createHash } from "crypto";
import { gunzipSync, inflateSync } from "zlib";
import { HarController } from "../util/HarController";
import { parse as parseSearchParams } from "querystring";
import { range as iterRange } from "iter-tools";
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
  stgValCharsSent: string;
};

export type SyntacticMatcher = (
  requestValue: string
) => (storageValue: string) => SyntacticMatcherResult;

export type SyntacticMatcherResult = { token: string } | undefined;

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

    // We group storage sources having the same itemId and value, then for each
    // group we join all (distinct) storage value chars that have been sent.
    const storageItemsSent = _.values(
      _.groupBy(
        sources.filter((source) => source.type === "Storage"),
        ({ itemId, value }) => JSON.stringify({ itemId, value })
      )
    ).map((group) => {
      const { itemId, value, valueRange } = group[0];
      const stgValCharsSentIndexesSet = new Set<number>();
      for (const i of iterRange(valueRange.begin, valueRange.end)) {
        stgValCharsSentIndexesSet.add(i);
      }
      const stgValCharsSent = _.sortBy([...stgValCharsSentIndexesSet])
        .map((i) => value.at(i))
        .join("");
      return { itemId, value, stgValCharsSent };
    });

    for (const {
      itemId,
      value: storageValue,
      stgValCharsSent,
    } of storageItemsSent) {
      history.push({
        itemId,
        storageValue,
        // senderOrigin,
        receiverOrigin,
        requestValue,
        stgValCharsSent,
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
      _.groupBy(
        // Consider only storage read operations
        storageOperations.filter(({ type }) => type === "Read"),
        ({ value }) => value
      ),
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
      requestValue,
      matcher: syntacticMatch(requestValue),
    }));

    for (const [storageValue, storageValueGroup] of storageOperationGroups) {
      let match: { requestValue: string; token: string } | undefined;
      for (const { requestValue, matcher } of requestValueMatchers) {
        const matcherResult = matcher(storageValue);
        if (matcherResult) {
          const { token } = matcherResult;
          match = { requestValue, token };
          break;
        }
      }
      if (!match) continue;
      const { requestValue, token } = match;
      for (const { itemId, value: storageValue } of storageValueGroup) {
        history.push({
          itemId,
          storageValue,
          // senderOrigin,
          receiverOrigin,
          requestValue,
          stgValCharsSent: token, // TODO: the first occurrence may not be the unique one, to be revised
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

  return (storageValue: string): SyntacticMatcherResult => {
    const token =
      requestValues.find((requestValue) =>
        storageValue.includes(requestValue)
      ) ??
      (requestValues.some((requestValue) => requestValue.includes(storageValue))
        ? storageValue
        : undefined);
    return token ? { token } : undefined;
  };
};

export const syntacticMatchCookieguard: SyntacticMatcher = (
  requestValue: string
) => {
  return (storageValue: string) => {
    const tokens = storageValue
      .split(/[^A-Za-z0-9]/)
      .filter((x) => x.length >= 8);

    const matchSomeTokenInQuery = (
      encoder?: (value: string) => string
    ): SyntacticMatcherResult => {
      const token = tokens.find((t) =>
        requestValue.includes(encoder ? encoder(t) : t)
      );
      return token ? { token } : undefined;
    };

    return (
      matchSomeTokenInQuery() ||
      matchSomeTokenInQuery((t) => Buffer.from(t).toString("base64")) ||
      matchSomeTokenInQuery((t) => createHash("md5").update(t).digest("hex")) ||
      matchSomeTokenInQuery((t) => createHash("sha1").update(t).digest("hex"))
    );
  };
};
