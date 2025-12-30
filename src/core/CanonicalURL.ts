export function getCanonicalUrl(url: string): string {
  const { origin, pathname, searchParams } = new URL(url);
  const paramNames = [...searchParams.entries()]
    .flatMap(([key, value]) => (value ? [key] : []))
    .sort();
  return origin + pathname + "?" + paramNames.join("&");
}

export function sameCanonicalUrl(a: string, b: string): boolean {
  return getCanonicalUrl(a) === getCanonicalUrl(b);
}
