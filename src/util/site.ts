import psl from "psl";

export function isSameSite(
  thisURL: string | URL,
  thatURL: string | URL
): boolean {
  return (
    getSiteByDomain(new URL(thisURL).hostname) ===
    getSiteByDomain(new URL(thatURL).hostname)
  );
}

export function getSiteByDomain(domain: string): string {
  const site = psl.get(domain);
  return site ?? domain;
}
