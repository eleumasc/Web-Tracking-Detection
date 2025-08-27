import assert from "assert";
import openDocumentStore from "../data/openDocumentStore";
import { SITES_COLL_TYPE } from "./cmdLoadSiteList";
import { SiteEntry } from "../core/SiteEntry";
import { processTaskQueue } from "../util/TaskQueue";
import { CredentialProvider } from "../core/credential/CredentialProvider";
import BugmenotCredentialProvider from "../core/credential/BugmenotCredentialProvider";

export default async function cmdFetchCredentials(
  args: {
    sitesId: number;
  } & {
    maxTasks: number;
  }
) {
  const credentialProvider: CredentialProvider =
    new BugmenotCredentialProvider();

  const store = openDocumentStore();

  const sitesCollection = store.getCollectionById(args.sitesId);
  assert(sitesCollection.meta.type === SITES_COLL_TYPE);

  const tbdEntries = store
    .getDocumentsWithDataByCollection<SiteEntry>(sitesCollection.id)
    .filter(({ data: { credentials } }) => !Boolean(credentials));

  await processTaskQueue(
    tbdEntries,
    { maxTasks: args.maxTasks },
    (entry, queueIndex) => async () => {
      const {
        document: { id: documentId },
        data: oldSiteEntry,
      } = entry;
      const { name: siteName } = oldSiteEntry;
      try {
        const credentials = await credentialProvider.get(
          oldSiteEntry.landingPage
        );
        const newSiteEntry = <SiteEntry>{ ...oldSiteEntry, credentials };
        store.updateDocumentData(documentId, newSiteEntry);
        console.log(`done ${siteName} [${queueIndex}]`);
      } catch (e) {
        console.error(`failed ${siteName} [${queueIndex}]`, e);
      }
    }
  );

  process.exit(0);
}
