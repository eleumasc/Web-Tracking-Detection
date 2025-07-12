import assert from "assert";
import openDocumentStore from "../core/openDocumentStore";
import writeOutputFileSync from "../core/writeOutputFileSync";
import { Credentials } from "../core/credentials/Credentials";
import { CredentialsMap } from "../core/credentials/CredentialsMap";
import { SiteEntry } from "../core/SiteEntry";
import { SITES_COLLECTION_TYPE } from "../commands/cmdLoadSiteList";

const RE_EMAIL: RegExp =
  /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

(async () => {
  const srcStore = openDocumentStore(process.argv[2]); // BugMeNot
  const srcSitesId = parseInt(process.argv[3]);
  const dstStore = openDocumentStore();

  const srcCollection = srcStore.getCollectionById(srcSitesId);
  assert(srcCollection.meta.type === SITES_COLLECTION_TYPE);

  const dstCollection = dstStore.createCollection(
    null,
    `BugMeNot-${srcCollection.name}`,
    { type: SITES_COLLECTION_TYPE }
  );
  const dstSitesId = dstCollection.id;

  console.log(`Sites Collection ID: ${dstCollection.id}`);

  const credentialsMap: CredentialsMap = [];

  for (const srcDocument of srcStore.getDocumentsByCollection(srcSitesId)) {
    const { name, rank, loginPageCandidates, credentialsCandidates } =
      srcStore.getDocumentData(srcDocument.id) as SiteEntry & {
        credentialsCandidates: Credentials[];
      };

    const foundCredentials = credentialsCandidates.find((cred) =>
      RE_EMAIL.test(cred.username)
    );
    if (!foundCredentials) continue;

    dstStore.createDocument(dstSitesId, srcDocument.name, {
      name,
      rank,
      loginPageCandidates,
    });
    credentialsMap.push({
      url: `https://${name}/`,
      credentials: foundCredentials,
    });
  }

  writeOutputFileSync(
    `BugMeNot-${srcCollection.name}`,
    JSON.stringify(credentialsMap),
    "secret"
  );
})();
