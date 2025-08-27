import assert from "assert";
import { runAnalyze } from "../commands/cmdAnalyze";
import openDocumentStore from "../data/openDocumentStore";
import { SITES_COLL_TYPE } from "../commands/cmdLoadSiteList";
import { SiteEntry } from "../core/SiteEntry";

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
