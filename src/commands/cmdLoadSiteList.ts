import _ from "lodash";
import assert from "assert";
import lineSplitter from "../util/lineSplitter";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { download } from "../util/download";
import { pipeline } from "stream/promises";
import { SiteEntry } from "../core/SiteEntry";
import { Transform, Writable } from "stream";

export const SITES_COLL_TYPE = "sites";

const BUFFER_SIZE: number = 50;

export default async function cmdLoadSiteList(options: {
  pathOrUrl: string | URL;
}) {
  let { pathOrUrl } = options;
  let filename: string;
  if (URL.canParse(pathOrUrl)) {
    pathOrUrl = new URL(pathOrUrl);
    filename = String(pathOrUrl);
  } else {
    pathOrUrl = path.resolve(pathOrUrl as string);
    filename = path.basename(pathOrUrl);
  }

  const downloadReadable = await download(pathOrUrl);

  const store = openDocumentStore();

  const sitesCollection = store.createCollection(null, filename, {
    type: SITES_COLL_TYPE,
  });

  console.log(`Sites Collection ID: ${sitesCollection.id}`);

  const buffer: { name: string; data: SiteEntry }[] = [];
  await pipeline(
    downloadReadable,
    lineSplitter(),
    new Transform({
      objectMode: true,
      async transform(data, _, callback) {
        try {
          const siteEntry = createSiteEntry(data);
          callback(null, siteEntry);
        } catch (e) {
          console.error(e);
          callback();
        }
      },
    }),
    new Writable({
      objectMode: true,
      write(siteEntry: SiteEntry, _, callback) {
        console.log(`${siteEntry.name} [${siteEntry.rank}]`);
        buffer.push({ name: siteEntry.name, data: siteEntry });
        if (buffer.length >= BUFFER_SIZE) {
          store.bulkInsertDocuments(sitesCollection.id, buffer);
          buffer.length = 0;
        }
        callback();
      },
      final(callback) {
        if (buffer.length !== 0) {
          store.bulkInsertDocuments(sitesCollection.id, buffer);
          buffer.length = 0;
        }
        callback();
      },
    })
  );

  process.exit(0);
}

function createSiteEntry(data: any): SiteEntry {
  assert(typeof data === "string");
  const parts = data.split(",");
  assert(parts.length === 2);
  const [rankString, name] = parts;
  const rank = parseInt(rankString);
  assert(!isNaN(rank));
  return { name, rank };
}
