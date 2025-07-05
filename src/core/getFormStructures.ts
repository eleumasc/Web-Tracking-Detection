import { Frame, Locator, Page } from "playwright";

export type FormStructure = FormStructureBase & {
  formLocator: Locator;
  frame: Frame;
};

type FormStructureBase = {
  textInputs: number;
  passwordInputs: number;
  checkboxInputs: number;
  radioInputs: number;
  registerFormFieldsDetected: boolean;
};

export default async function getFormStructures(page: Page) {
  return (
    await Promise.allSettled(
      page
        .frames()
        .filter((frame) => frame.url()) // see https://github.com/microsoft/playwright/issues/9675
        .map(async (frame): Promise<FormStructure[]> => {
          const formLocators = await frame.locator("form").all();
          return Promise.all(
            formLocators.map(async (formLocator) => ({
              ...(await formLocator.evaluate(getFormStructurePageFunction)),
              formLocator,
              frame,
            }))
          );
        })
    )
  )
    .filter((result) => result.status === "fulfilled")
    .flatMap(({ value }) => value);
}

const getFormStructurePageFunction = (
  form: HTMLFormElement
): FormStructureBase => {
  // const SIGNUP_FORM_FIELDS_REGEXP: RegExp =
  //   /full(\-|_|\s)*name|(f(irst|ore)?|m(iddle)?)(\-|_|\s)*name|(l(ast|st)?|s(u)?(r)?)(\-|_|\s)*name|prefix|month|day|year|birthdate|birthday|date(\-|_|\s)*of(\-|_|\s)*birth|(\-|_|\s)+age(\-|_|\s)+|gender|sex|addr|(post(al)?|zip)(\-|_|\s)*(code|no|num)|city|town|location|country|state|province|street|(building|bldng|flat|apartment|apt|home|house)(\-|_|\s)*(num|no)|card(\-|_|\s)*(no|num)|credit(\-|_|\s)*(no|num|card)|expire|expiration|sec(urity)?(\-|_|\s)*(no|num|cvv|code)|company|organi(z|s)ation|institut(e|ion)/i;

  // element visibility heuristics à la Playwright
  const isVisible = (element: HTMLElement) => {
    const boundingBox = element.getBoundingClientRect();
    if (boundingBox.width === 0 || boundingBox.height === 0) {
      return false;
    }
    const computedStyle = getComputedStyle(element);
    if (computedStyle.visibility !== "visible") {
      return false;
    }
    return true;
  };

  let textInputs = 0;
  let passwordInputs = 0;
  let checkboxInputs = 0;
  let radioInputs = 0;
  const names: Record<string, boolean> = {
    // @ts-ignore
    __proto__: null,
  };
  for (const inputElement of form.querySelectorAll("input")) {
    if (!isVisible(inputElement)) continue;
    const { name, type } = inputElement as HTMLInputElement;
    if (!name || !names[name]) {
      switch (type) {
        case "text":
        case "email":
          textInputs += 1;
          break;
        case "password":
          passwordInputs += 1;
          break;
        case "checkbox":
          checkboxInputs += 1;
          break;
        case "radio":
          radioInputs += 1;
          break;
      }
      if (name) {
        names[name] = true;
      }
    }
  }
  // const registerFormFieldsDetected = SIGNUP_FORM_FIELDS_REGEXP.test(
  //   form.innerHTML
  // );
  return {
    textInputs,
    passwordInputs,
    checkboxInputs,
    radioInputs,
    registerFormFieldsDetected: false,
  };
};
