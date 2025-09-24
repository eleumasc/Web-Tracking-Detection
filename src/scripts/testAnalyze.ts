import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { getOutputPath } from "../data/outputDir";
import { rootDir } from "../env";
import { runAnalyze } from "../commands/cmdAnalyze";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLL_TYPE } from "../commands/cmdLoadSiteList";

async function main(args: { sitesId: number; siteName: string }) {
  const store = openDocumentStore();

  const sitesCollection = store.getCollectionById(args.sitesId);
  assert(sitesCollection.meta.type === SITES_COLL_TYPE);

  const siteDocument = store.getDocumentByName(
    sitesCollection.id,
    args.siteName
  );
  const siteEntry = store.getDocumentData<SiteEntry>(siteDocument.id);

  const result = await runAnalyze(siteEntry, {
    headlessBrowser: false,
    outputPath: getOutputPath(`runAnalyze-${currentTime()}`),
  });

  console.log(result);

  process.exit(0);
}

main(
  ((argv) => {
    return {
      sitesId: parseInt(argv[0]),
      siteName: argv[1],
    };
  })(process.argv.slice(2))
);
