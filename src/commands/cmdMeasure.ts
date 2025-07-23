import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../core/openDocumentStore";
import writeOutputFileSync from "../core/writeOutputFileSync";
import { ANALYZE_COLLECTION_TYPE, AnalyzeEntry } from "./cmdAnalyze";
import { isFailure } from "../util/Completion";
import {
  digestTaintReport,
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

  const relevantSites: any[] = [];
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
      value: { taintReports, loggedInCompletion },
    } = analyzeEntry;

    if (
      loggedInCompletion &&
      (isFailure(loggedInCompletion) || !loggedInCompletion.value)
    )
      continue;

    const relevantTaintReports = taintReports.flatMap((taintReport) =>
      digestTaintReport(taintReport, isNetworkSource(), isStorageSink())
    );
    if (relevantTaintReports.length > 0) {
      relevantSites.push({ site, relevantTaintReports });
    }
  }

  const report = {
    relevantSites,
  };
  writeOutputFileSync(`measure-${currentTime()}.json`, JSON.stringify(report));

  process.exit(0);
}
