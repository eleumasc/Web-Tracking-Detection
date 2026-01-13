export function getCanonicalUrl(url: string): string {
  const { origin, pathname, searchParams } = new URL(url);
  const pathSegments = pathname.split("/").slice(1);
  const paramNames = [...searchParams.entries()]
    .flatMap(([key, value]) => (value ? [key] : []))
    .sort();
  return origin + "/" + pathSegments.join("/") + "?" + paramNames.join("&");
}

export function sameCanonicalUrl(a: string, b: string): boolean {
  return getCanonicalUrl(a) === getCanonicalUrl(b);
}
