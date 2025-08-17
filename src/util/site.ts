import psl from "psl";

export function getSiteByUrl(url: string | URL, base?: string | URL): string {
  return getSiteByDomain(new URL(url, base).hostname);
}

export function getSiteByDomain(domain: string): string {
  const site = psl.get(domain);
  return site ?? domain;
}
