import AdmZip from "adm-zip";
import assert from "assert";
import { Entry, Har as HarRecord, PostData } from "har-format";

export class Har {
  protected harRecord: HarRecord | undefined;

  constructor(readonly file: string) {}

  data(): HarRecord {
    let { harRecord } = this;
    if (!harRecord) {
      harRecord = JSON.parse(this.getEntryData("har.har"));
      this.harRecord = harRecord;
    }
    return harRecord!;
  }

  entries(): Entry[] {
    return this.data().log.entries;
  }

  readPostData(postData: PostData): string {
    assert("_file" in postData);
    const file = postData["_file"] as string;
    return this.getEntryData(file);
  }

  protected getEntryData(name: string): string {
    const zip = new AdmZip(this.file);
    const harEntry = zip.getEntry(name);
    assert(harEntry);
    return harEntry.getData().toString();
  }
}

export function findRequestId(entry: Entry): string | undefined {
  const { request } = entry;
  const rawRequestId = request.headers.find(
    ({ name }) => name === "X-Foxhound-RequestId",
  )?.value;
  if (!rawRequestId) {
    return undefined;
  }
  const requestId = rawRequestId.replace(/,.*/, "");
  const redirectCountStr = request.headers.find(
    ({ name }) => name === "X-Foxhound-RedirectCount",
  )?.value;
  if (!redirectCountStr) {
    return undefined;
  }
  return `${requestId}:${redirectCountStr}`;
}
