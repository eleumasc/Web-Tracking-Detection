import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import openDocumentStore from "../data/openDocumentStore";
import writeOutputFileSync from "../data/writeOutputFileSync";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry, LTAResult } from "../core/AnalysisLogEntry";
import { isFailure, isSuccess } from "../util/Completion";
import {
  digestTaintReport,
  isLocSink,
  isLocSource,
  isNetworkSink,
  isNetworkSource,
  isPasswordSource,
  isStorageSink,
  isStorageSource,
  TaintOperationPredicate,
} from "../foxhound/taint";

export default function cmdMeasure(args: {
  analysisId: number;
  srcKey: string;
  snkKey: string;
  dbFilepath: string | undefined;
}) {
  const { analysisId, srcKey, snkKey } = args;

  const srcPredicateFactory = new Map<
    string,
    (ltaResult: LTAResult) => TaintOperationPredicate
  >([
    ["Pwd", (ltaResult) => isPasswordSource(ltaResult.credential.password)],
    ["Stg", () => isStorageSource()],
    ["Net", () => isNetworkSource()],
    ["Loc", () => isLocSource()],
  ]).get(srcKey);
  assert(srcPredicateFactory, `Invalid source: ${srcKey}`);

  const snkPredicateFactory = new Map<
    string,
    (ltaResult: LTAResult) => TaintOperationPredicate
  >([
    ["Stg", () => isStorageSink()],
    ["Net", () => isNetworkSink()],
    ["Loc", () => isLocSink()],
  ]).get(snkKey);
  assert(snkPredicateFactory, `Invalid sink: ${snkKey}`);

  const store = openDocumentStore(args.dbFilepath);

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);

  const relevantSites: any[] = [];
  for (const analysisDocument of store.getDocumentsByCollection(
    analysisCollection.id
  )) {
    const site = analysisDocument.name;
    console.log(site);

    const analysisLogEntry = store.getDocumentData(
      analysisDocument.id
    ) as AnalysisLogEntry;

    if (isFailure(analysisLogEntry)) continue;
    const { value: ltaResults } = analysisLogEntry;
    const ltaResult = ltaResults.find(
      ({ loginCompletion }) =>
        isSuccess(loginCompletion) && loginCompletion.value.credentialValid
    );
    if (!ltaResult) continue;
    const { taintReports } = ltaResult;
    assert(taintReports);

    const srcPredicate = srcPredicateFactory(ltaResult);
    const snkPredicate = snkPredicateFactory(ltaResult);
    const relevantTaintReports = taintReports.flatMap((taintReport) =>
      digestTaintReport(taintReport, srcPredicate, snkPredicate)
    );
    if (relevantTaintReports.length > 0) {
      relevantSites.push({ site, relevantTaintReports });
    }
  }

  const report = {
    relevantSites,
  };
  writeOutputFileSync(
    `measure-${currentTime()}-${analysisId}-${srcKey}${snkKey}.json`,
    JSON.stringify(report)
  );

  process.exit(0);
}
