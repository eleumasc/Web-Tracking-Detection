import { dispatcher } from "./Task";
import { doTestComputeTrackingRequests } from "../core/taintTracking/doTestComputeTrackingRequests";
import { processTrackingRequests } from "../core/processTrackingRequests";
import { runAnalyze, runSimulateConnect } from "../core/runAnalyze";

export default dispatcher({
  runAnalyze,
  runSimulateConnect,
  processTrackingRequests,
  doTestComputeTrackingRequests,
});
