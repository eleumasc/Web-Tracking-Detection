import assert from "assert";
import { readFileSync } from "fs";
import { SiteEntry } from "../core/SiteEntry";

export function readSiteList(filePath: string): SiteEntry[] {
  return readFileSync(filePath)
    .toString()
    .split(/[\r\n]/)
    .map((x) => x.trim())
    .filter((x) => x)
    .map((x): SiteEntry => {
      const parts = x.split(",");
      const rank = parseInt(parts[0].trim());
      assert(!isNaN(rank));
      const site = parts[1].trim();
      assert(site);
      return { name: site, rank };
    });
}
