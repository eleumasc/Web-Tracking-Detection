import { HarController } from "../../util/HarController";
import { originFromUrl } from "../AbstractFlow";

export type RequestEntry = {
  param: string;
  value: string;
  receiverOrigin: string;
};

export function getRequestEntriesFromHar(
  harController: HarController
): RequestEntry[] {
  return harController.entries().flatMap((harEntry) => {
    const {
      request: { url: requestUrl, postData },
    } = harEntry;
    const requestURL = new URL(requestUrl);
    const receiverOrigin = originFromUrl(requestURL);

    const requestEntries: RequestEntry[] = [];
    requestEntries.push({
      param: "urlPath",
      value: requestURL.pathname,
      receiverOrigin,
    });
    requestEntries.push({
      param: "urlQuery",
      value: requestURL.search,
      receiverOrigin,
    });
    if (postData) {
      requestEntries.push({
        param: "postData",
        value: harController.readPostData(postData),
        receiverOrigin,
      });
    }
    return requestEntries;
  });
}
