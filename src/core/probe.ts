import installFoxhoundTaintReporting from "../util/installFoxhoundTaintReporting";
import locateLoginFormFields from "./locateLoginFormFields";
import { BrowserContext } from "playwright";
import { hasSource, isPasswordSource } from "./taint";
import { TaintReport } from "./foxhound";
import { timeout } from "../util/timeout";

export type ProbeResult = {
  password: string;
  taintReports: TaintReport[];
};

export const FAKE_USERNAME: string = "qRG1etu18qHQGBvv@gmail.com";
export const FAKE_PASSWORD: string = "5vpO>F4<c6_/%H68";

const SIMULATE_TIMEOUT_MS: number = 10 * 1000; // 10 seconds

export default async function probe(
  browser: BrowserContext,
  options: {
    loginPageUrl: string;
  }
): Promise<ProbeResult> {
  const { loginPageUrl } = options;
  const username = FAKE_USERNAME;
  const password = FAKE_PASSWORD;

  // capture taint reports
  const taintReports: TaintReport[] = [];
  await installFoxhoundTaintReporting(browser, {
    onTaintReport: (taintReport) => {
      taintReports.push(taintReport);
    },
  });

  const page = await browser.newPage();

  // navigate to login page and locate login form fields
  const { usernameField, passwordField, submitButton } =
    await locateLoginFormFields(page, { loginPageUrl });

  // simulate login
  await usernameField.fill(username);
  await passwordField.fill(password);
  await submitButton.click();
  await timeout(SIMULATE_TIMEOUT_MS);

  return {
    password,
    taintReports: taintReports.filter((taintReport) =>
      hasSource(taintReport, isPasswordSource(password))
    ),
  };
}
