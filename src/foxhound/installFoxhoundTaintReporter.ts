import path from "path";
import { BrowserContext, Page } from "playwright";
import { rootDir } from "../env";
import { TaintReport } from "./types";
import { timeout } from "../util/timeout";

const NAVIGATE_TIMEOUT_MS: number = 3 * 1000; // 3 seconds

export default async function installFoxhoundTaintReporter(
  context: BrowserContext | Page,
  options: {
    onTaintReport: (taintReport: TaintReport) => void;
    delayNavigationRequests?: boolean;
  }
): Promise<void> {
  const { onTaintReport, delayNavigationRequests } = options;

  await context.addInitScript({
    path: path.resolve(rootDir, "inbrowser", "foxhoundTaintReporter.js"),
  });

  await context.exposeBinding(
    "__playwright_taint_report",
    async (_source, taintReport: TaintReport) => {
      onTaintReport(taintReport);
    }
  );

  if (!Boolean(delayNavigationRequests)) return;

  // delay navigation requests to have a chance to capture taint reports after changing location
  await context.route(
    () => true,
    async (route) => {
      if (route.request().isNavigationRequest()) {
        await timeout(NAVIGATE_TIMEOUT_MS);
      }
      route.continue();
    }
  );
}
