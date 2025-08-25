import { runAnalyze } from "../commands/cmdAnalyze";
import { runLoginTaintAnalysisForRecoverScreenshots } from "../scripts/recoverScreenshots";

export const MP_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  runAnalyze,
  runLoginTaintAnalysisForRecoverScreenshots,
};
