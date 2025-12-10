import _ from "lodash";
import assert from "assert";
import { AbstractFlow, AbstractMatch, originFromUrl } from "../AbstractFlow";
import { Cookie, StorageItem } from "../StorageItem";
import { FoxhoundReport } from "../../foxhound/types";
import { getTaintFlowsFromFoxhoundReports, StorageTaintOperation, TaintRange } from "./TaintFlow";
import { HarController } from "../../util/HarController";
import { OperationToken } from "../syntacticMatching/Token";


export function getTaintAbstractFlows(
  foxhoundReports: FoxhoundReport[],
  storageItems: StorageItem[],
  harController: HarController
): {
  abstractFlows: AbstractFlow[];
} {
  const findSingleStorageItemByTaintOperation = (
    op: StorageTaintOperation
  ): StorageItem | undefined => {
    const { storageType, key, value, locUrl } = op;
    let foundArray = storageItems.filter(
      ({ id: storageId, value: storageValue }) => storageType === storageId.storageType &&
        key === storageId.key &&
        value === storageValue &&
        ((storageId.storageType === "cookie"
          ? ("." + locUrl.hostname).endsWith(storageId.domain)
          : locUrl.origin === storageId.origin) ||
          locUrl.href === "about:blank") // WARNING!
    );
    if (foundArray.length >= 2 && storageType === "cookie") {
      const maxLengthDomainCookie = _.maxBy(
        foundArray as Cookie[],
        ({ id: { domain } }) => domain.length
      );
      assert(maxLengthDomainCookie);
      foundArray = [maxLengthDomainCookie];
    }
    assert(
      foundArray.length < 2,
      `Expected to find at most one StorageItem, but found ${foundArray.length}`
    );
    return foundArray.length === 1 ? foundArray[0] : undefined;
  };

  const abstractFlows: AbstractFlow[] = [];
  for (const flow of getTaintFlowsFromFoxhoundReports(foxhoundReports)) {
    const { ranges, sink } = flow;

    if (sink.type !== "Network") continue;
    const { str: requestValue } = flow;
    const { requestUrl } = sink;

    // Consider only taint flows such that there is an HAR entry whose
    // request URL corresponds to that of the network sink.
    // This especially helps to remove taint flows whose network sink do not
    // initiate a network request (e.g., set img.src to data URIs).
    if (!harController.hasRequestWithUrl(requestUrl)) {
      console.log(requestUrl);
      continue;
    }

    const receiverUrl = requestUrl;
    const receiverOrigin = originFromUrl(receiverUrl);

    const storageItemsSent = _.values(
      _.groupBy(
        ranges
          .filter(
            (range): range is TaintRange & { source: { type: "Storage"; }; } => range.source.type === "Storage"
          )
          .flatMap((range) => {
            const { source } = range;
            const storageItem = findSingleStorageItemByTaintOperation(source);
            return storageItem ? [{ range, storageItem }] : [];
          }),
        ({ storageItem }) => JSON.stringify(storageItem)
      )
    ).map((group) => {
      const { storageItem } = group[0];
      const { value: storageValue } = storageItem;
      const rootStorageToken: OperationToken = {
        input: null,
        value: storageValue,
      };
      const rootRequestToken: OperationToken = {
        input: null,
        value: requestValue,
      };
      const matches = group.map(
        ({
          range: {
            begin: requestBegin, end: requestEnd, source: {
              valueRange: { begin: storageBegin, end: storageEnd },
            },
          },
        }): AbstractMatch => {
          const storageToken: OperationToken = {
            input: rootStorageToken,
            operation: "slice",
            range: { begin: storageBegin, end: storageEnd },
            value: storageValue.substring(storageBegin, storageEnd),
          };
          const requestToken: OperationToken = {
            input: rootRequestToken,
            operation: "arbitrary",
            range: { begin: requestBegin, end: requestEnd },
            value: requestValue.substring(requestBegin, requestEnd),
          };
          return { storageToken, requestToken };
        }
      );
      return { storageItem, matches };
    });

    for (const { storageItem, matches } of storageItemsSent) {
      abstractFlows.push({
        storageItem,
        receiverOrigin,
        matches,
      });
    }
  }
  return { abstractFlows };
}
