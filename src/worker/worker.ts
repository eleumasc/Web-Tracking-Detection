import { dispatcher } from "./Task";
import { processTrackingRequests } from "../core/processTrackingRequests";
import { runAnalyze, runSimulateConnect } from "../core/runAnalyze";

export default dispatcher({
  runAnalyze,
  runSimulateConnect,
  processTrackingRequests,
});
