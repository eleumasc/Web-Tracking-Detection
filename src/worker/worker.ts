import { dispatcher } from "./Task";
import { measureSite } from "../commands/cmdMeasure";
import { runAnalyze, runSimulateConnect } from "../core/runAnalyze";

export default dispatcher({
  runAnalyze,
  runSimulateConnect,
  measureSite,
});
