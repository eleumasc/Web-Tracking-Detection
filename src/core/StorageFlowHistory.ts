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
  for (const {
    startedDateTime: requestDateTime,
    request: { url, postData: postDataObj, headers },
  } of harEntries) {
    const requestTime = Date.parse(requestDateTime);
    // const initiator = headers.find(({ name }) => name === "X-Initiator")?.value;
    // if (!initiator) continue;
    const postData = postDataObj && harController.readPostData(postDataObj);
    // const senderOrigin = originFromUrl(initiator);
    const receiverOrigin = originFromUrl(url);
    for (const [value, valueGroup] of storageReadGroups) {
      const syntacticMatches =
        syntacticMatchUrl(value, url) ||
        (postData && syntacticMatch(value, postData));
      if (!syntacticMatches) continue;
      for (const { itemId, value, timestamp: storageReadTime } of valueGroup) {
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
