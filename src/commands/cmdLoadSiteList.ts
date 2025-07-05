import assert from "assert";
import openDocumentStore from "../core/openDocumentStore";
import path from "path";
import { createReadStream } from "fs";
import { parser } from "stream-json";
import { pipeline } from "stream/promises";
import { SiteDetail } from "../core/SiteDetail";
import { streamArray } from "stream-json/streamers/StreamArray";
import { Transform, Writable } from "stream";

export const SITES_COLLECTION_TYPE = "sites";

export default async function cmdLoadSiteList(filepath: string) {
  const store = openDocumentStore();

  filepath = path.resolve(filepath);
  const filename = path.basename(filepath);

  const sitesCollection = store.createCollection(null, filename, {
    type: SITES_COLLECTION_TYPE,
  });

  console.log(`Sites Collection ID: ${sitesCollection.id}`);

  await pipeline(
    createReadStream(filepath),
    parser(),
    streamArray(),
    new Transform({
      objectMode: true,
      transform({ value: data }, _, callback) {
        try {
          const siteDetail = createSiteDetail(data);
          callback(null, siteDetail);
        } catch {
          callback();
        }
      },
    }),
    new Writable({
      objectMode: true,
      write(siteDetail, _, callback) {
        store.createDocument(sitesCollection.id, siteDetail.name, siteDetail);
        callback();
      },
    })
  );

  process.exit(0);
}

function createSiteDetail(data: any): SiteDetail {
  assert(Boolean(data.resolved));
  return {
    name: data.domain,
    rank: data.rank,
    loginPageCandidates: data.login_page_candidates.map(
      (x: any) => x.login_page_candidate
    ),
  };
}
