import _ from "lodash";
import assert from "assert";
import path from "path";
import { download } from "./download";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { HostnameSuffixMap } from "./HostnameSuffixMap";
import { rootDir } from "../env";
import { text } from "stream/consumers";

export type Disconnect = HostnameSuffixMap;

let disconnect: Disconnect | undefined;

export async function initDisconnect() {
  if (disconnect) {
    return;
  }

  const disconnectPath = path.join(rootDir, "disconnect.json");

  let raw: string;
  if (!existsSync(disconnectPath)) {
    raw = await text(
      await download(
        "https://raw.githubusercontent.com/disconnectme/disconnect-tracking-protection/refs/heads/master/services.json",
      ),
    );
    writeFileSync(disconnectPath, raw);
  } else {
    raw = readFileSync(disconnectPath).toString();
  }

  const cooked = JSON.parse(raw);

  // {
  //   categories: {
  //     [category: string]: Array<{
  //       [organization: string]: {
  //         [homepage: string]: string[]; // trackers
  //       };
  //     }>;
  //   };
  // };
  const trackers = _.uniq(
    Object.entries<any>(cooked.categories)
      .flatMap(([_category, categoryOrgs]): string[] =>
        categoryOrgs.flatMap((orgRecord: any): string[] => {
          const homepageRecord = Object.values<any>(orgRecord)[0];
          const trackers = Object.values<string[]>(homepageRecord)[0];
          return trackers;
        }),
      )
      .filter((s) => /^[A-Za-z0-9\-.]+$/.test(s)),
  );

  disconnect = new HostnameSuffixMap(trackers);
}

export function checkInDisconnect(hostname: string): boolean {
  assert(disconnect, "Use initDisconnect() first");
  return disconnect.includes(hostname);
}
