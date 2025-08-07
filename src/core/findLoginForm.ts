import detectLoginForm from "./detectLoginForm";
import getFormStructures, { FormStructure } from "./getFormStructures";
import { Locator, Page } from "playwright";

export type FindLoginFormResult = {
  usernameField: Locator;
  passwordField: Locator;
  submitButton: Locator;
  loginForm: FormStructure;
};

export default async function findLoginForm(
  page: Page
): Promise<FindLoginFormResult | undefined> {
  const formStructures = await getFormStructures(page);
  const loginForm = detectLoginForm(formStructures);
  if (!loginForm) return undefined;
  try {
    const result = await getResult(loginForm);
    return result;
  } catch {
    return undefined;
  }
}

async function getResult(
  loginForm: FormStructure
): Promise<FindLoginFormResult> {
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
