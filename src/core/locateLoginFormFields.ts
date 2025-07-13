import findLoginForm from "./findLoginForm";
import getFormStructures, { FormStructure } from "./getFormStructures";
import { Locator, Page } from "playwright";
import { timeout } from "../util/timeout";

const NAVIGATE_EXTRA_TIMEOUT_MS: number = 10000;

export type LocateLoginFormFieldsResult = {
  usernameField: Locator;
  passwordField: Locator;
  submitButton: Locator;
  loginForm: FormStructure;
};

export default async function locateLoginFormFields(
  page: Page,
  options: {
    loginPageUrl?: string;
  }
): Promise<LocateLoginFormFieldsResult> {
  const { loginPageUrl } = options;

  if (loginPageUrl) {
    await page.goto(loginPageUrl);
    await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);
  }

  const formStructures = await getFormStructures(page);
  const loginForm = findLoginForm(formStructures);
  if (loginForm) {
    return getResult(loginForm);
  } else {
    throw new Error("Cannot find login form");
  }
}

async function getResult(
  loginForm: FormStructure
): Promise<LocateLoginFormFieldsResult> {
  const usernameField = loginForm.formLocator
    .locator('input[type="text"], input[type="email"]')
    .first();
  if ((await usernameField.count()) === 0) {
    throw new Error("Cannot locate username field");
  }

  const passwordField = loginForm.formLocator
    .locator('input[type="password"]')
    .first();
  if ((await passwordField.count()) === 0) {
    throw new Error("Cannot locate password field");
  }

  const submitButton = loginForm.formLocator
    .locator('input[type="submit"], button[type="submit"]')
    .first();
  if ((await submitButton.count()) === 0) {
    throw new Error("Cannot locate submit button");
  }

  return {
    usernameField,
    passwordField,
    submitButton,
    loginForm,
  };
}
