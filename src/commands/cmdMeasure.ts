import _ from "lodash";
import assert from "assert";
import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import Flatted from "flatted";
import openDocumentStore from "../data/openDocumentStore";
import path from "path";
import { ANALYSIS_LOGS_COLL_TYPE } from "./cmdAnalyze";
import { AnalysisLogEntry } from "../core/AnalysisLogEntry";
import { Flow } from "../core/Flow";
import { getOutputPath, writeOutputFileSync } from "../data/outputDir";
import { getSiteFromUrl } from "../util/site";
import { HarReader } from "../util/HarReader";
import { isFailure } from "../util/Completion";
import { makeTaskFromFunction } from "../worker/Task";
import { processFlows } from "../core/processFlows";
import { processTaskQueue } from "../util/TaskQueue";
import { readFileSync } from "fs";
import { StatefulTrackingAnalysisResult } from "../core/AnalysisResult";
import { TrackerEquivalence, viewTrackers } from "../core/Tracker";
import { verifySyntacticFlows } from "../core/syntacticMatching/verifySyntacticFlows";
import {
  CanonicalFlowEquivalence,
  viewCanonicalFlows,
} from "../core/CanonicalFlow";
import {
  Accumulator,
  arrayLengthSumCountPair,
  assign,
  nonZeroCount,
  pairSum,
} from "../util/Accumulator";

export default async function cmdMeasure(args: {
  analysisId: number;
  maxTasks: number;
}) {
  const { analysisId } = args;

  const store = openDocumentStore();

  const analysisCollection = store.getCollectionById(analysisId);
  assert(analysisCollection, ANALYSIS_LOGS_COLL_TYPE);
  const { name: analysisName } = analysisCollection;

  const outputName = `${currentTime()}-Measure-${analysisId}`;

  const statsAccumulator = new Accumulator({
    totalSites: nonZeroCount(),
    successSites: nonZeroCount(),
    intersectTrackers: pairSum(),
    onlyTaintTrackers: pairSum(),
    onlySyntacticTrackers: pairSum(),
    trueOnlySyntacticTrackers: pairSum(),
    intersectFlows: pairSum(),
    onlyTaintFlows: pairSum(),
    onlySyntacticFlows: pairSum(),
    trueOnlySyntacticFlows: pairSum(),
    fakeOnlySyntacticFlows: pairSum(),
    unknownOnlySyntacticFlows: pairSum(),
  });

  await processTaskQueue(
    store.getDocumentsByCollection(analysisCollection.id),
    { maxTasks: args.maxTasks },
    (analysisDocument, queueIndex) => async () => {
      const siteName = analysisDocument.name;
      console.log(siteName, queueIndex);

      statsAccumulator.add("totalSites", 1);

      const analysisLogEntry = store.getDocumentData<
        AnalysisLogEntry<StatefulTrackingAnalysisResult>
      >(analysisDocument.id);

      if (isFailure(analysisLogEntry)) return;
      const { value: staResult } = analysisLogEntry;

      statsAccumulator.add("successSites", 1);

      const stats = await execThread<ReturnType<typeof measureSite>>(
        makeTaskFromFunction(measureSite, [
          {
            siteName,
            analysisName,
            outputName,
            staResult,
          },
        ])
      );

      statsAccumulator.addAll(stats);
    }
  );

  const report = statsAccumulator.snapshot();
  console.log(report);
  writeOutputFileSync(
    path.join(outputName, "report.json"),
    JSON.stringify(report)
  );

  process.exit(0);
}

export function measureSite(args: {
  siteName: string;
  analysisName: string;
  outputName: string;
  staResult: StatefulTrackingAnalysisResult;
  forceNoVerif?: boolean;
}) {
  const { siteName, analysisName, outputName, staResult, forceNoVerif } = args;

  let rawTaintFlows: Flow[];
  let rawSyntacticFlows: Flow[];
  let verifyResult;
  if (staResult.verif && !forceNoVerif) {
    rawTaintFlows = Flatted.parse(
      readFileSync(
        path.join(getOutputPath(analysisName), staResult.verif.taintFlowsFile)
      ).toString()
    );
    rawSyntacticFlows = Flatted.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.syntacticFlowsFile
        )
      ).toString()
    );
    const storageCanariesEntries = Flatted.parse(
      readFileSync(
        path.join(
          getOutputPath(analysisName),
          staResult.verif.storageCanariesFile
        )
      ).toString()
    );
    verifyResult = verifySyntacticFlows(
      rawSyntacticFlows,
      storageCanariesEntries,
      new HarReader(
        path.join(getOutputPath(analysisName), staResult.verif.harFile)
      )
    );
  } else {
    const processed = processFlows({
      analysisName,
      auxConnectResult: staResult.aux.connectResult,
      preConnectResult: staResult.pre.connectResult,
      taintHarFile: staResult.taint.harFile,
      taintTaintFile: staResult.taint.taintFile,
    });
    rawTaintFlows = processed.taintFlows;
    rawSyntacticFlows = processed.syntacticFlows;
    const storageCanariesEntries = processed.storageCanariesEntries;
    writeOutputFileSync(
      path.join(outputName, `${siteName}+TF.json`),
      Flatted.stringify(rawTaintFlows)
    );
    writeOutputFileSync(
      path.join(outputName, `${siteName}+SF.json`),
      Flatted.stringify(rawSyntacticFlows)
    );
    writeOutputFileSync(
      path.join(outputName, `${siteName}+C.json`),
      Flatted.stringify(storageCanariesEntries)
    );
  }

  const firstParty = getSiteFromUrl(
    staResult.taint.connectResult.landingPageUrl
  );
  const filterThirdPartyFlows = (flows: Flow[]): Flow[] =>
    flows.filter((flow) => getSiteFromUrl(flow.requestUrl) !== firstParty);
  rawTaintFlows = filterThirdPartyFlows(rawTaintFlows);
  rawSyntacticFlows = filterThirdPartyFlows(rawSyntacticFlows);

  const detailsAccumulator = new Accumulator({
    intersectTrackers: assign(),
    onlyTaintTrackers: assign(),
    onlySyntacticTrackers: assign(),
    trueOnlySyntacticTrackers: assign(),
    trueOnlySyntacticFlows: assign(),
    fakeOnlySyntacticFlows: assign(),
    unknownOnlySyntacticFlows: assign(),
  });
  const statsAccumulator = new Accumulator({
    intersectTrackers: arrayLengthSumCountPair(),
    onlyTaintTrackers: arrayLengthSumCountPair(),
    onlySyntacticTrackers: arrayLengthSumCountPair(),
    trueOnlySyntacticTrackers: arrayLengthSumCountPair(),
    intersectFlows: arrayLengthSumCountPair(),
    onlyTaintFlows: arrayLengthSumCountPair(),
    onlySyntacticFlows: arrayLengthSumCountPair(),
    trueOnlySyntacticFlows: arrayLengthSumCountPair(),
    fakeOnlySyntacticFlows: arrayLengthSumCountPair(),
    unknownOnlySyntacticFlows: arrayLengthSumCountPair(),
  });

  const taintTrackers = TrackerEquivalence.getAllKeys(rawTaintFlows);
  const syntacticTrackers = TrackerEquivalence.getAllKeys(rawSyntacticFlows);
  const intersectTrackers = _.intersectionWith(
    taintTrackers,
    syntacticTrackers,
    _.isEqual
  );
  const onlyTaintTrackers = _.differenceWith(
    taintTrackers,
    syntacticTrackers,
    _.isEqual
  );
  const onlySyntacticTrackers = _.differenceWith(
    syntacticTrackers,
    taintTrackers,
    _.isEqual
  );
  detailsAccumulator.addAll({
    intersectTrackers: viewTrackers(intersectTrackers, rawTaintFlows),
    onlyTaintTrackers: viewTrackers(onlyTaintTrackers, rawTaintFlows),
    onlySyntacticTrackers: viewTrackers(
      onlySyntacticTrackers,
      rawSyntacticFlows
    ),
  });
  statsAccumulator.addAll({
    intersectTrackers,
    onlyTaintTrackers,
    onlySyntacticTrackers,
  });

  if (verifyResult) {
    const trueOnlySyntacticTrackers = _.intersectionWith(
      TrackerEquivalence.getAllKeys(verifyResult.trueFlows),
      onlySyntacticTrackers,
      _.isEqual
    );
    detailsAccumulator.addAll({
      trueOnlySyntacticTrackers: viewTrackers(
        trueOnlySyntacticTrackers,
        verifyResult.trueFlows
      ),
    });
    statsAccumulator.addAll({
      trueOnlySyntacticTrackers,
    });
  }

  const taintFlows = CanonicalFlowEquivalence.getAllKeys(rawTaintFlows);
  const syntacticFlows = CanonicalFlowEquivalence.getAllKeys(rawSyntacticFlows);
  const intersectFlows = _.intersectionWith(
    taintFlows,
    syntacticFlows,
    _.isEqual
  );
  const onlyTaintFlows = _.differenceWith(
    taintFlows,
    syntacticFlows,
    _.isEqual
  );
  const onlySyntacticFlows = _.differenceWith(
    syntacticFlows,
    taintFlows,
    _.isEqual
  );
  statsAccumulator.addAll({
    intersectFlows,
    onlyTaintFlows,
    onlySyntacticFlows,
  });

  if (verifyResult) {
    const trueOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(verifyResult.trueFlows),
      onlySyntacticFlows,
      _.isEqual
    );
    const fakeOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(verifyResult.fakeFlows),
      onlySyntacticFlows,
      _.isEqual
    );
    const unknownOnlySyntacticFlows = _.intersectionWith(
      CanonicalFlowEquivalence.getAllKeys(verifyResult.unknownFlows),
      onlySyntacticFlows,
      _.isEqual
    );
    detailsAccumulator.addAll({
      trueOnlySyntacticFlows: viewCanonicalFlows(
        trueOnlySyntacticFlows,
        verifyResult.trueFlows
      ),
      fakeOnlySyntacticFlows: viewCanonicalFlows(
        fakeOnlySyntacticFlows,
        verifyResult.fakeFlows
      ),
      unknownOnlySyntacticFlows: viewCanonicalFlows(
        unknownOnlySyntacticFlows,
        verifyResult.unknownFlows
      ),
    });
    statsAccumulator.addAll({
      trueOnlySyntacticFlows,
      fakeOnlySyntacticFlows,
      unknownOnlySyntacticFlows,
    });
  }

  writeOutputFileSync(
    path.join(outputName, `${siteName}.json`),
    JSON.stringify({
      site: siteName,
      ...detailsAccumulator.snapshot(),
    })
  );

  return statsAccumulator.snapshot();
}
