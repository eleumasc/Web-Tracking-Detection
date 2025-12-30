import psl from "psl";

export function getSiteFromUrl(url: string | URL, base?: string | URL): string {
  return getSiteFromDomain(new URL(url, base).hostname);
}

export function getSiteFromDomain(domain: string): string {
  const site = psl.get(domain);
  return site ?? domain;
}
