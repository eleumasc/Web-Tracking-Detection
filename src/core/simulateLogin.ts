import findLoginForm from "./findLoginForm";
import { BrowserContext } from "playwright";
import { Credential } from "./credential/Credential";
import { timeout } from "../util/timeout";

export type SimulateLoginResult = {
  credentialValid: boolean;
  captcha?: boolean;
};

const NAVIGATE_EXTRA_TIMEOUT_MS: number = 10 * 1000; // 10 seconds
const LOGIN_EXTRA_TIMEOUT_MS: number = 5 * 1000; // 5 seconds

export default async function simulateLogin(
  browser: BrowserContext,
  options: {
    loginPageCandidate: string;
    credential: Credential;
  }
): Promise<SimulateLoginResult> {
  const { loginPageCandidate, credential } = options;
  const { username, password } = credential;

  const page = await browser.newPage();

  // navigate to login page
  const navigateToLoginPage = async () => {
    try {
      await page.goto(loginPageCandidate);
    } catch (e) {
      throw new SimulateLoginError(String(e));
    }
    await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);
  };
  await navigateToLoginPage();

  // find login form
  const loginForm = await findLoginForm(page);
  if (!loginForm) {
    throw new SimulateLoginError("Cannot find login form");
  }
  const { usernameField, passwordField, submitButton } = loginForm;

  // simulate login
  await usernameField.fill(username);
  await passwordField.fill(password);
  await submitButton.click();
  await timeout(LOGIN_EXTRA_TIMEOUT_MS);
  await page.waitForLoadState();

  // validate login
  // We do not solve CAPTCHAs, but the absence of a detected login form is a strong signal that the credential are valid.
  const credentialValid = !Boolean(await findLoginForm(page));
  // If the credentials are valid but the login form is still present after navigating back to the login page, a CAPTCHA is likely required.
  let captcha: boolean | undefined;
  if (credentialValid) {
    await navigateToLoginPage();
    captcha = Boolean(await findLoginForm(page));
  }

  return { credentialValid, captcha };
}

export class SimulateLoginError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = SimulateLoginError.name;
  }
}
