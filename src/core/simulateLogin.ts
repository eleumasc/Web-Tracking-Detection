import locateLoginFormFields from "./locateLoginFormFields";
import { Page } from "playwright";
import { Taint, TaintReport, TaintReportWithoutTaint } from "./foxhound";
import { timeout } from "../util/timeout";

export type SimulateLoginResult = {
  taintReports: TaintReport[];
};

const SIMULATE_TIMEOUT_MS: number = 5 * 1000; // 5 seconds

export default async function simulateLogin(
  page: Page,
  options: {
    loginPageUrl: string;
    username: string;
    password: string;
  }
): Promise<SimulateLoginResult> {
  const { loginPageUrl, username, password } = options;

  const taintReports: TaintReport[] = [];
  let captureEnabled: boolean = false;

  // capture taint reports
  await page.addInitScript({
    content:
      "window.addEventListener('__taintreport', (r) => { __playwright_taint_report(r.detail, r.detail.str.taint); });",
  });
  await page.exposeBinding(
    "__playwright_taint_report",
    async (_source, value: TaintReportWithoutTaint, taint: Taint) => {
      if (!captureEnabled) return;
      taintReports.push({ ...value, taint });
    }
  );

  // navigate to login page and locate login form fields
  const { usernameField, passwordField, submitButton } =
    await locateLoginFormFields(page, { loginPageUrl });

  // start capturing taint reports
  captureEnabled = true;

  // simulate login
  await usernameField.fill(username);
  await passwordField.fill(password);
  await submitButton.click();

  await timeout(SIMULATE_TIMEOUT_MS);

  return { taintReports };
}
