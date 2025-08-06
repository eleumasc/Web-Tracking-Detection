import { BrowserContext, Page } from "playwright";
import { Taint, TaintReport, TaintReportWithoutTaint } from "./types";
import { timeout } from "../util/timeout";

const NAVIGATE_TIMEOUT_MS: number = 3 * 1000; // 3 seconds

export default async function installFoxhoundTaintReporting(
  context: BrowserContext | Page,
  options: {
    onTaintReport: (taintReport: TaintReport) => void;
    delayNavigationRequests?: boolean;
  }
): Promise<void> {
  const { onTaintReport, delayNavigationRequests } = options;

  await context.addInitScript({
    content:
      "window.addEventListener('__taintreport', (r) => { __playwright_taint_report(r.detail, r.detail.str.taint); });",
  });

  await context.exposeBinding(
    "__playwright_taint_report",
    async (_source, value: TaintReportWithoutTaint, taint: Taint) => {
      onTaintReport({ ...value, taint });
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
