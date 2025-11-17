import { dispatcher } from "./Task";
import { runAnalyze, runSimulateConnect } from "../commands/cmdAnalyze";

export default dispatcher({
  runAnalyze,
  runSimulateConnect,
});
