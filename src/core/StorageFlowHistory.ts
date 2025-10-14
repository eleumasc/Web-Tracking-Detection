import _ from "lodash";
import { Entry as HarEntry } from "har-format";
import { HarController } from "../util/HarController";
import { TaintReport } from "../foxhound/types";
import {
  getAbstractFlowsFromTaintReports,
  StorageOperation,
} from "./AbstractFlow";

export type StorageFlowHistory = StorageFlow[];

export type StorageFlow = {
  itemId: string;
  value: string;
} & (
  | {
      type: "Create";
      creatorOrigin: string;
    }
  | {
      type: "Send";
      senderOrigin: string;
      receiverOrigin: string;
    }
);

export function getTaintStorageFlowHistory(
  taintReports: TaintReport[]
): StorageFlowHistory {
  const history: StorageFlowHistory = [];
  for (const flow of getAbstractFlowsFromTaintReports(taintReports)) {
    const { sources, sink } = flow;
    const { type: sinkType } = sink;
    if (sinkType === "Storage") {
      const { location, itemId, value } = sink;
      history.push({
        type: "Create",
        itemId,
        value,
        creatorOrigin: originFromUrl(location),
      });
    } else if (sinkType === "Network") {
      const { location, requestUrl } = sink;
      const senderOrigin = originFromUrl(location);
      const receiverOrigin = originFromUrl(requestUrl);
      for (const { itemId, value } of sources.filter(
        (source) => source.type === "Storage"
      )) {
        history.push({
          type: "Send",
          itemId,
          value,
          senderOrigin,
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

  // Create
  for (const { location, itemId, value } of storageOperations.filter(
    ({ type }) => type === "Write"
  )) {
    history.push({
      type: "Create",
      itemId,
      value,
      creatorOrigin: originFromUrl(location),
    });
  }

  // Send
  for (const {
    startedDateTime: requestDateTime,
    request: { url, postData, headers },
  } of harEntries) {
    const initiator = headers.find(({ name }) => name === "X-Initiator")?.value;
    if (!initiator) continue;
    const senderOrigin = originFromUrl(initiator);
    const receiverOrigin = originFromUrl(url);
    // add all storage items whose value syntactically matches the URL
    const candidateStorageReads = _.toPairs(
      _.mapValues(
        _.groupBy(
          storageOperations
            .filter(({ type }) => type === "Read")
            .filter(
              ({ timestamp: storageOperationTime }) =>
                storageOperationTime < Date.parse(requestDateTime)
            ),
          ({ value }) => value
        ),
        (valueGroup) =>
          _.values(_.groupBy(valueGroup, ({ itemId }) => itemId)).map(
            (iidGroup) => _.maxBy(iidGroup, ({ timestamp }) => timestamp)!
          )
      )
    ); // .filter(([value]) => zxcvbn(value).guesses_log10 >= 9); // filter storage items à la Journey
    for (const [value, valueGroup] of candidateStorageReads) {
      if (!syntacticMatchUrl(value, url)) continue;
      if (postData) {
        if (!syntacticMatch(value, harController.readPostData(postData)))
          continue;
      }
      for (const { itemId, value } of valueGroup) {
        history.push({
          type: "Send",
          itemId,
          value,
          senderOrigin,
          receiverOrigin,
        });
      }
    }
  }

  return history;
}

function syntacticMatchUrl(storageValue: string, url: string): boolean {
  return syntacticMatch(storageValue, new URL(url).search);
}

function syntacticMatch(storageValue: string, str: string): boolean {
  const MIN_STR_LENGTH: number = 8;

  const tokens = storageValue
    .split(/[^A-Za-z0-9]/)
    .filter((x) => x.length >= MIN_STR_LENGTH);
  if (tokens.some((t) => str.includes(t))) {
    return true;
  }

  const base64Tokens = tokens.map((t) => Buffer.from(t).toString("base64"));
  if (base64Tokens.some((t) => str.includes(t))) {
    return true;
  }

  return false;
}

function originFromUrl(url: string): string {
  return new URL(url).hostname;
}
