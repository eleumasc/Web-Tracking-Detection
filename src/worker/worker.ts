import { dispatcher } from "./Task";
import { doTestComputeTaintedRequests } from "../core/taintTracking/doTestComputeTaintedRequests";
import { processTrackingRequests } from "../core/processTrackingRequests";
import { runAnalyze, runSimulateConnect } from "../core/runAnalyze";

export default dispatcher({
  runAnalyze,
  runSimulateConnect,
  processTrackingRequests,
  doTestComputeTaintedRequests,
});
