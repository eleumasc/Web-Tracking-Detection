import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../data/openDocumentStore";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { isFailure } from "../util/Completion";
import { writeOutputFileSync } from "../data/outputDir";

export default function cmdMeasure(args: {
  analysisId: number;
  dbPath: string | undefined;
}) {
  const { analysisId } = args;

  const store = openDocumentStore(args.dbPath);

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);

  for (const analysisDocument of store.getDocumentsByCollection(
    analysisCollection.id
  )) {
    const site = analysisDocument.name;
    console.log(site);

    const analysisLogEntry = store.getDocumentData<AnalysisLogEntry>(
      analysisDocument.id
    );

    if (isFailure(analysisLogEntry)) continue;

    // TODO: implement
  }

  const report = {};
  writeOutputFileSync(
    `Measure-${currentTime()}-${analysisId}.json`,
    JSON.stringify(report)
  );

  process.exit(0);
}
