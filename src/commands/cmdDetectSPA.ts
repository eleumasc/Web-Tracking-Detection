import _ from "lodash";
import assert from "assert";
import openDocumentStore from "../core/openDocumentStore";
import { detectSPA } from "../core/detectSPA";
import { PROBE_COLLECTION_TYPE, ProbeEntry } from "./cmdProbe";
import { writeFileSync } from "fs";

export default function cmdDetectSPA(args: {
  analysisId: number;
  dbFilepath: string | undefined;
}) {
  const store = openDocumentStore(args.dbFilepath);

  const analysisCollection = store.getCollectionById(args.analysisId);
  assert(analysisCollection, PROBE_COLLECTION_TYPE);

  let relevantSites: any[] = [];
  for (const probeDocument of store.getDocumentsByCollection(
    analysisCollection.id
  )) {
    const site = probeDocument.name;
    console.log(site);

    const probeEntry = store.getDocumentData(probeDocument.id) as ProbeEntry;

    const found = detectSPA(probeEntry);

    if (found) {
      relevantSites = [...relevantSites, site];
    }
  }

  const report = {
    relevantSites,
  };
  writeFileSync("report.json", JSON.stringify(report));

  process.exit(0);
}
