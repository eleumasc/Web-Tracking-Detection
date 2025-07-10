import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../core/openDocumentStore";
import writeOutputFileSync from "../core/writeOutputFileSync";
import { ANALYZE_COLLECTION_TYPE, AnalyzeEntry } from "./cmdAnalyze";
import { isFailure } from "../util/Completion";
import {
  hasSink,
  hasSource,
  isNetworkSource,
  isStorageSink,
} from "../core/taint";

export default function cmdMeasure(args: {
  analysisId: number;
  dbFilepath: string | undefined;
}) {
  const store = openDocumentStore(args.dbFilepath);

  const analysisCollection = store.getCollectionById(args.analysisId);
  assert(analysisCollection, ANALYZE_COLLECTION_TYPE);

  const relevantSites: string[] = [];
  for (const analysisDocument of store.getDocumentsByCollection(
    analysisCollection.id
  )) {
    const site = analysisDocument.name;
    console.log(site);

    const analyzeEntry = store.getDocumentData(
      analysisDocument.id
    ) as AnalyzeEntry;

    if (isFailure(analyzeEntry)) continue;
    const {
      value: { taintReports },
    } = analyzeEntry;

    if (
      taintReports.some(
        (taintReport) =>
          hasSource(taintReport, isNetworkSource()) &&
          hasSink(taintReport, isStorageSink())
      )
    ) {
      relevantSites.push(site);
    }
  }

  const report = {
    relevantSites,
  };
  writeOutputFileSync(`measure-${currentTime()}.json`, JSON.stringify(report));

  process.exit(0);
}
