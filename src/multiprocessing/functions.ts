import { runAnalyze } from "../commands/cmdAnalyze";

export const MP_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  runAnalyze,
};
