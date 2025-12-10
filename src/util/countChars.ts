export function countAlphanumChars(str: string): number {
  return [...str.matchAll(/[A-Za-z0-9]/g)].length;
}
