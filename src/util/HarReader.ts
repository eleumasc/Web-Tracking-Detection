import AdmZip from "adm-zip";
import assert from "assert";
import {
  Content,
  Entry,
  Har,
  PostData
  } from "har-format";

export class HarReader {
  protected _data: Har | undefined;

  constructor(readonly zipFile: string) {}

  data(): Har {
    return (
      this._data ??
      (this._data = (() => {
        return JSON.parse(this.getEntryData("har.har"));
      })())
    );
  }

  entries(): Entry[] {
    return this.data().log.entries;
  }

  followRedirects(initialEntry: Entry): Entry {
    const entries = this.entries();
    let entry = initialEntry;
    let entryIndex = entries.indexOf(entry);
    assert(entryIndex !== -1);
    let redirectURL: string;
    while ((redirectURL = entry.response.redirectURL) !== "") {
      redirectURL = new URL(redirectURL).href; // normalize redirectURL
      entryIndex = entries.findIndex(
        (e, i) => i > entryIndex && e.request.url === redirectURL
      );
      assert(
        entryIndex !== -1,
        `Cannot follow redirects: ${initialEntry.request.url}`
      );
      entry = entries[entryIndex];
    }
    return entry;
  }

  readContent(content: Content): string {
    if (content.size === -1) return "";
    assert("_file" in content);
    const file = content["_file"] as string;
    return this.getEntryData(file);
  }

  readPostData(postData: PostData): string {
    assert("_file" in postData);
    const file = postData["_file"] as string;
    return this.getEntryData(file);
  }

  hasRequestWithUrl(url: string): boolean {
    const toNormalizedUrl = (url: string): string => {
      const urlObject = new URL(url);
      urlObject.hash = "";
      return urlObject.href;
    };
    const urlNormalized = toNormalizedUrl(url);
    return this.entries().some(
      ({ request: { url: requestUrl } }) =>
        toNormalizedUrl(requestUrl) === urlNormalized
    );
  }

  protected getEntryData(name: string): string {
    const zip = new AdmZip(this.zipFile);
    const harEntry = zip.getEntry(name);
    assert(harEntry);
    return harEntry.getData().toString();
  }
}
