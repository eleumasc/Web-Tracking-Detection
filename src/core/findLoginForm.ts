import { FormStructure } from "./getFormStructures";

export default function findLoginForm(
  formStructures: FormStructure[]
): FormStructure | undefined {
  return formStructures.find((fs) => {
    return (
      fs.textInputs === 1 &&
      fs.passwordInputs === 1 &&
      !fs.registerFormFieldsDetected
    );
  });
}
