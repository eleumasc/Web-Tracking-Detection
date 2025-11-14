import path from "path";
import { BrowserContext, Page } from "playwright";
import { FoxhoundReport } from "./types";
import { rootDir } from "../env";

export default async function installFoxhoundTaintReporter(
  context: BrowserContext | Page,
  options: {
    onTaintReport: (taintReport: FoxhoundReport) => void;
  }
): Promise<void> {
  const { onTaintReport } = options;

  await context.addInitScript({
    path: path.resolve(rootDir, "setup", "foxhoundTaintReporter.js"),
  });

  await context.exposeBinding(
    "__playwright_taint_report",
    async (_source, taintReport: FoxhoundReport) => {
      onTaintReport(taintReport);
    }
  );
}
