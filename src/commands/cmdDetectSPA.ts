import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../core/openDocumentStore";
import writeOutputFileSync from "../core/writeOutputFileSync";
import { detectSPA } from "../core/detectSPA";
import { PROBE_COLLECTION_TYPE, ProbeEntry } from "./cmdProbe";

export default function cmdDetectSPA(args: {
  analysisId: number;
  dbFilepath: string | undefined;
}) {
  const store = openDocumentStore(args.dbFilepath);

  const analysisCollection = store.getCollectionById(args.analysisId);
  assert(analysisCollection, PROBE_COLLECTION_TYPE);

  let spaEntries: any[] = [];
  for (const probeDocument of store.getDocumentsByCollection(
    analysisCollection.id
  )) {
    const site = probeDocument.name;
    console.log(site);

    const probeEntry = store.getDocumentData(probeDocument.id) as ProbeEntry;

    const detected = detectSPA(probeEntry);

    if (detected) {
      const { loginPageUrl } = detected;
      spaEntries = [...spaEntries, { site, loginPageUrl }];
    }
  }

  const report = {
    spaEntries,
  };
  writeOutputFileSync(`detectSPA-${currentTime()}.json`, JSON.stringify(report));

  process.exit(0);
}
