import { dispatcher } from "./Task";
import { runAnalyze, runSimulateConnect } from "../core/runAnalyze";

export default dispatcher({
  runAnalyze,
  runSimulateConnect,
});
