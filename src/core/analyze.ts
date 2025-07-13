import installFoxhoundTaintReporting from "../util/installFoxhoundTaintReporting";
import locateLoginFormFields from "./locateLoginFormFields";
import { BrowserContext } from "playwright";
import { Completion, toCompletion } from "../util/Completion";
import { Credentials } from "./credentials/Credentials";
import { TaintReport } from "./foxhound";
import { timeout } from "../util/timeout";

export type AnalyzeResult = {
  credentials: Credentials;
  taintReports: TaintReport[];
  loggedInCompletion?: Completion<boolean>;
};

const SIMULATE_TIMEOUT_MS: number = 30 * 1000; // 30 seconds

export default async function analyze(
  browser: BrowserContext,
  options: {
    loginPageUrl: string;
    credentials: Credentials;
  }
): Promise<AnalyzeResult> {
  const { loginPageUrl, credentials } = options;
  const { username, password } = credentials;

  // capture taint reports
  const taintReports: TaintReport[] = [];
  await installFoxhoundTaintReporting(browser, {
    delayNavigationRequests: true,
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

  const loggedInCompletion = await toCompletion(async () => {
    try {
      await locateLoginFormFields(page, {});
      return false;
    } catch (e) {
      if (e instanceof Error && e.message === "Cannot find login form") {
        return true;
      }
      throw e;
    }
  });

  return {
    credentials,
    taintReports,
    loggedInCompletion,
  };
}
