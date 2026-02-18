import assert from "assert";
import path from "path";
import { download } from "./download";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { rootDir } from "../env";
import { text } from "stream/consumers";

export type Disconnect = Record<string, string[]>;

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
  disconnect = Object.fromEntries(
    Object.entries<any>(cooked.categories).map(
      ([category, organizations]): [string, string[]] => [
        category,
        organizations.flatMap((organizationRecord: any): string[] => {
          const homepageRecord = Object.values<any>(organizationRecord)[0];
          const trackers = Object.values<string[]>(homepageRecord)[0];
          return trackers;
        }),
      ],
    ),
  );
}

export function checkInDisconnect(site: string): boolean {
  assert(disconnect, "Use initDisconnect() first");
  return Object.values(disconnect) //
    .some((categoryTrackers) => categoryTrackers.includes(site));
}
