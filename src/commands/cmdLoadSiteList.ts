import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { createReadStream } from "fs";
import { parser } from "stream-json";
import { pipeline } from "stream/promises";
import { SiteEntry } from "../core/SiteEntry";
import { streamArray } from "stream-json/streamers/StreamArray";
import { Transform, Writable } from "stream";

export const SITES_COLL_TYPE = "sites";

export default async function cmdLoadSiteList(filepath: string) {
  const store = openDocumentStore();

  filepath = path.resolve(filepath);
  const filename = path.basename(filepath);

  const sitesCollection = store.createCollection(null, filename, {
    type: SITES_COLL_TYPE,
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
          const siteEntry = createSiteEntry(data);
          if (siteEntry) {
            callback(null, siteEntry);
          } else {
            // not resolved
            callback();
          }
        } catch (e) {
          console.error(e);
          callback();
        }
      },
    }),
    new Writable({
      objectMode: true,
      write(siteEntry, _, callback) {
        store.createDocument(sitesCollection.id, siteEntry.name, siteEntry);
        callback();
      },
    })
  );

  process.exit(0);
}

function createSiteEntry(data: any): SiteEntry | undefined {
  if (!Boolean(data.resolved)) return undefined;
  return {
    name: data.domain,
    rank: data.rank,
    loginPageCandidates: data.login_page_candidates.map(
      (x: any) => x.login_page_candidate
    ),
  };
}
