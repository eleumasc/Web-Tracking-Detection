import path from "path";
import { BrowserContext, Page } from "playwright";
import { FoxhoundReport } from "./types";
import { rootDir } from "../env";

export default async function installFoxhoundTaintReporter(
  context: BrowserContext | Page,
  options: {
    onReport: (foxhoundReport: FoxhoundReport) => void;
  }
): Promise<void> {
  const { onReport } = options;

  await context.addInitScript({
    path: path.resolve(rootDir, "setup", "foxhoundTaintReporter.js"),
  });

  await context.exposeBinding(
    "__playwright_taint_report",
    async (_source, foxhoundReport: FoxhoundReport) => {
      onReport(foxhoundReport);
    }
  );
}
