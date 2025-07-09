import locateLoginFormFields from "./locateLoginFormFields";
import { BrowserContext } from "playwright";
import { hasPasswordSource } from "./taint";
import { Taint, TaintReport, TaintReportWithoutTaint } from "./foxhound";
import { timeout } from "../util/timeout";

export type ProbeResult = {
  password: string;
  taintReports: TaintReport[];
};

const SIMULATE_TIMEOUT_MS: number = 5 * 1000; // 5 seconds
const NAVIGATE_TIMEOUT_MS: number = 3 * 1000; // 3 seconds

export default async function probe(
  browser: BrowserContext,
  options: {
    loginPageUrl: string;
    username: string;
    password: string;
  }
): Promise<ProbeResult> {
  const { loginPageUrl, username, password } = options;

  // capture taint reports
  const taintReports: TaintReport[] = [];
  await browser.addInitScript({
    content:
      "window.addEventListener('__taintreport', (r) => { __playwright_taint_report(r.detail, r.detail.str.taint); });",
  });
  await browser.exposeBinding(
    "__playwright_taint_report",
    async (_source, value: TaintReportWithoutTaint, taint: Taint) => {
      taintReports.push({ ...value, taint });
    }
  );

  const page = await browser.newPage();

  // navigate to login page and locate login form fields
  const { usernameField, passwordField, submitButton } =
    await locateLoginFormFields(page, { loginPageUrl });

  // delay navigation requests to have a chance to capture taint reports after changing location
  await page.route(
    () => true,
    async (route) => {
      if (route.request().isNavigationRequest()) {
        await timeout(NAVIGATE_TIMEOUT_MS);
      }
      route.continue();
    }
  );

  // simulate login
  await usernameField.fill(username);
  await passwordField.fill(password);
  await submitButton.click();
  await timeout(SIMULATE_TIMEOUT_MS);

  return {
    password,
    taintReports: taintReports.filter((taintReport) =>
      hasPasswordSource(taintReport.taint, password)
    ),
  };
}
