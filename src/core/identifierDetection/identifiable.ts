import zxcvbn from "zxcvbn";

export function isIdentifiable(value: string): boolean {
  // return isLengthIdentifiable(value) && isZxcvbnIdentifiable(value);
  return isLengthIdentifiable(value) && isPasswordEntropyIdentifiable(value);
}

export function isLengthIdentifiable(value: string): boolean {
  return value.length >= 8;
}

export function isZxcvbnIdentifiable(value: string): boolean {
  return value.length >= 128 || zxcvbn(value).guesses_log10 >= 9;
}

export function isPasswordEntropyIdentifiable(value: string): boolean {
  return passwordEntropy(value) >= 30; // value enables to identify about one user over 10^9
}

function passwordEntropy(password: string): number {
  password = password.replace(/[^A-Za-z0-9]/g, "");

  if (!password) return 0;

  let hasLower = false;
  let hasUpper = false;
  let hasDigit = false;

  for (const ch of password) {
    if (/[a-z]/.test(ch)) hasLower = true;
    else if (/[A-Z]/.test(ch)) hasUpper = true;
    else if (/[0-9]/.test(ch)) hasDigit = true;
  }

  let R = 0;
  if (hasLower) R += 26;
  if (hasUpper) R += 26;
  if (hasDigit) R += 10;

  const L = password.length;

  return L * Math.log2(R);
}
