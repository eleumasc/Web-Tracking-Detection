import _ from "lodash";
import assert from "assert";
import openDocumentStore from "../core/openDocumentStore";
import { isSuccess } from "../util/Completion";
import { TaintOperation, TaintReport } from "../core/foxhound";
import { writeFileSync } from "fs";
import {
  AnalyzeResult,
  LOGIN_TAINT_ANALYSIS_COLLECTION_TYPE,
} from "./cmdAnalyze";

export default function cmdMeasure(args: {
  analysisId: number;
  dbFilepath: string | undefined;
}) {
  const store = openDocumentStore(args.dbFilepath);

  const analysisCollection = store.getCollectionById(args.analysisId);
  assert(analysisCollection, LOGIN_TAINT_ANALYSIS_COLLECTION_TYPE);

  let relevantSites: string[] = [];
  for (const analysisDocument of store.getDocumentsByCollection(
    analysisCollection.id
  )) {
    const site = analysisDocument.name;
    console.log(site);

    const analyzeResult = store.getDocumentData(
      analysisDocument.id
    ) as AnalyzeResult;

    if (
      analyzeResult.find(
        ({ simulateLoginCompletion: compl }) =>
          isSuccess(compl) &&
          compl.value.taintReports.some((taintReport) =>
            doesSendCredentialsInFlight(taintReport)
          )
      )
    ) {
      relevantSites = [...relevantSites, site];
    }
  }

  const report = {
    relevantSites,
  };
  writeFileSync("report.json", JSON.stringify(report));

  process.exit(0);
}

function doesSendCredentialsInFlight(taintReport: TaintReport): boolean {
  return (
    isInFlightNetworkSink(taintReport.sink) &&
    taintReport.taint.some(({ flow }) =>
      flow.some((taintOp) => isCredentialsSource(taintOp))
    )
  );
}

function isInFlightNetworkSink(sink: string): boolean {
  switch (sink) {
    case "XMLHttpRequest.open(url)":
    case "XMLHttpRequest.setRequestHeader(value)":
    case "XMLHttpRequest.send":
    case "fetch.url":
    case "fetch.body":
      return true;
    default:
      return false;
  }
}

function isCredentialsSource(taintOp: TaintOperation): boolean {
  return (
    taintOp.source &&
    taintOp.operation === "element.attribute" &&
    taintOp.arguments[1] === 'value="5vpO>F4<c6_/%H68"'
  );
}
