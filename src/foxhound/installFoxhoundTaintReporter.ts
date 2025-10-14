import path from "path";
import { BrowserContext, Page } from "playwright";
import { rootDir } from "../env";
import { TaintReport } from "./types";

export default async function installFoxhoundTaintReporter(
  context: BrowserContext | Page,
  options: {
    onTaintReport: (taintReport: TaintReport) => void;
  }
): Promise<void> {
  const { onTaintReport } = options;

  await context.addInitScript({
    path: path.resolve(rootDir, "setup", "foxhoundTaintReporter.js"),
  });

  await context.exposeBinding(
    "__playwright_taint_report",
    async (_source, taintReport: TaintReport) => {
      onTaintReport(taintReport);
    }
  );
}
