import _ from "lodash";
import Interval from "../util/Interval";
import { createHash } from "crypto";
import { FoxhoundReport } from "../foxhound/types";
import { getTaintFlowsFromFoxhoundReports } from "./TaintFlow";
import { gunzipSync, inflateSync } from "zlib";
import { HarController } from "../util/HarController";
import { parse as parseSearchParams } from "querystring";
import { Range } from "../util/Range";
import { StorageItem } from "./StorageItem";

export type AbstractFlow = {
  itemId: string;
  storageValue: string;
  // senderOrigin: string;
  receiverOrigin: string;
  requestValue: string;
  storageRanges: Range[];
};

export type SyntacticMatcher = (
  requestValue: string
) => (storageValue: string) => SyntacticMatch | undefined;

export type SyntacticMatch = { range: Range };

function originFromUrl(url: string): string {
  return new URL(url).origin;
}

export function getTaintAbstractFlows(
  foxhoundReports: FoxhoundReport[],
  harController: HarController
): AbstractFlow[] {
  const abstractFlows: AbstractFlow[] = [];
  for (const flow of getTaintFlowsFromFoxhoundReports(foxhoundReports)) {
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
        ({ itemId, value }) => JSON.stringify([itemId, value])
      )
    ).map((group) => {
      const { itemId, value: storageValue } = group[0];
      const storageInterval = new Interval();
      for (const {
        valueRange: { begin, end },
      } of group) {
        storageInterval.addRange(begin, end);
      }
      const storageRanges = storageInterval.getRanges();
      return { itemId, storageValue, storageRanges };
    });

    for (const { itemId, storageValue, storageRanges } of storageItemsSent) {
      abstractFlows.push({
        itemId,
        storageValue,
        // senderOrigin,
        receiverOrigin,
        requestValue,
        storageRanges,
      });
    }
  }
  return abstractFlows;
}

export function getSyntacticAbstractFlows(
  storageItems: StorageItem[],
  harController: HarController,
  syntacticMatcher: SyntacticMatcher
): AbstractFlow[] {
  const abstractFlows: AbstractFlow[] = [];
  const storageItemGroups = _.toPairs(
    _.groupBy(
      // Consider only storage read operations
      storageItems,
      ({ value }) => value
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

    const requestValueMatcherEntries = [
      requestURL.pathname,
      requestURL.search,
      ...(postData ? [harController.readPostData(postData)] : []),
    ].map((requestValue) => ({
      requestValue,
      requestValueMatcher: syntacticMatcher(requestValue),
    }));

    for (const [storageValue, storageItemGroup] of storageItemGroups) {
      let matchEntry:
        | { requestValue: string; match: SyntacticMatch }
        | undefined;
      for (const {
        requestValue,
        requestValueMatcher,
      } of requestValueMatcherEntries) {
        const match = requestValueMatcher(storageValue);
        if (match) {
          matchEntry = { requestValue, match: match };
          break;
        }
      }
      if (!matchEntry) continue;
      const {
        requestValue,
        match: { range },
      } = matchEntry;
      for (const {
        key: { itemId },
        value: storageValue,
      } of storageItemGroup) {
        abstractFlows.push({
          itemId,
          storageValue,
          // senderOrigin,
          receiverOrigin,
          requestValue,
          storageRanges: [range], // TODO: the first occurrence may not be the unique one, to be revised
        });
      }
    }
  }
  return abstractFlows;
}

export const journeySyntacticMatcher: SyntacticMatcher = (
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
    const range = ((): Range | undefined => {
      for (const requestValue of requestValues) {
        let index;
        if (requestValue.includes(storageValue)) {
          return { begin: 0, end: storageValue.length };
        } else if ((index = storageValue.indexOf(requestValue)) !== -1) {
          return { begin: index, end: index + requestValue.length };
        }
      }
      return undefined;
    })();
    return range ? { range } : undefined;
  };
};

export const cookieguardSyntacticMatcher: SyntacticMatcher = (
  requestValue: string
) => {
  return (storageValue: string) => {
    const tokenEntries = [...storageValue.matchAll(/[A-Za-z0-9]+/g)]
      .map(({ 0: token, index: begin }) => ({
        token,
        range: <Range>{ begin, end: begin + token.length },
      }))
      .filter(({ token }) => token.length >= 8);

    const matchSomeTokenInQuery = (
      encoder?: (value: string) => string
    ): SyntacticMatch | undefined => {
      const range = tokenEntries.find(({ token }) =>
        requestValue.includes(encoder ? encoder(token) : token)
      )?.range;
      return range ? { range } : undefined;
    };

    return (
      matchSomeTokenInQuery() ||
      matchSomeTokenInQuery((t) => Buffer.from(t).toString("base64")) ||
      matchSomeTokenInQuery((t) => createHash("md5").update(t).digest("hex")) ||
      matchSomeTokenInQuery((t) => createHash("sha1").update(t).digest("hex"))
    );
  };
};
