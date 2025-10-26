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
  value: string;
  // senderOrigin: string;
  receiverOrigin: string;
};

function originFromUrl(url: string): string {
  return new URL(url).hostname;
}

export function getTaintStorageFlowHistory(
  taintReports: TaintReport[]
): StorageFlowHistory {
  const history: StorageFlowHistory = [];
  for (const flow of getAbstractFlowsFromTaintReports(taintReports)) {
    const { sources, sink } = flow;
    const { type: sinkType } = sink;
    if (sinkType === "Network") {
      const { location, requestUrl } = sink;
      // const senderOrigin = originFromUrl(location);
      const receiverOrigin = originFromUrl(requestUrl);
      for (const { itemId, value } of sources.filter(
        (source) => source.type === "Storage"
      )) {
        history.push({
          itemId,
          value,
          // senderOrigin,
          receiverOrigin,
        });
      }
    }
  }
  return history;
}

export function getSyntacticStorageFlowHistory(
  storageOperations: StorageOperation[],
  harEntries: HarEntry[],
  harController: HarController
): StorageFlowHistory {
  const history: StorageFlowHistory = [];
  const storageReadGroups = _.toPairs(
    _.mapValues(
      _.groupBy(
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
  for (const harEntry of harEntries) {
    const {
      startedDateTime: requestDateTime,
      request: { url: requestUrl, postData },
    } = harEntry;
    const requestTime = Date.parse(requestDateTime);
    const requestURL = new URL(requestUrl);

    // const initiator = headers.find(({ name }) => name === "X-Initiator")?.value;
    // if (!initiator) continue;

    // const senderOrigin = originFromUrl(initiator);
    const receiverOrigin = originFromUrl(requestUrl);

    const syntacticMatch = syntacticMatchJourney; // syntacticMatchJourney or syntacticMatchCookieguard
    const matchers = [
      syntacticMatch(requestURL.pathname),
      syntacticMatch(requestURL.search),
      ...(postData
        ? [syntacticMatch(harController.readPostData(postData))]
        : []),
    ];

    for (const [storageValue, storageValueGroup] of storageReadGroups) {
      if (!matchers.some((match) => match(storageValue))) continue;
      for (const {
        itemId,
        value,
        timestamp: storageReadTime,
      } of storageValueGroup) {
        if (!(storageReadTime < requestTime)) continue;
        history.push({
          itemId,
          value,
          // senderOrigin,
          receiverOrigin,
        });
      }
    }
  }
  return history;
}

function syntacticMatchJourney(requestValue: string) {
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
    )
      .flatMap((values) => values ?? "")
      .filter((value) => value.length !== 0);
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
        const newValues = decoder(value);
        queue.push(...newValues);
      }
    }
  }

  const requestValues = [...generateCandidateRequestValues(requestValue)];

  return function (storageValue: string): boolean {
    for (const requestValue of requestValues) {
      if (
        requestValue.includes(storageValue) ||
        storageValue.includes(requestValue)
      ) {
        return true;
      }
    }
    return false;
  };
}

function syntacticMatchCookieguard(requestValue: string) {
  return function (storageValue: string): boolean {
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
}
