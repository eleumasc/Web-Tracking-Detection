import _ from "lodash";
import assert from "assert";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { Cookie, LocalStorageItem, StorageItem } from "../core/StorageItem";

export function patchFoxhoundProfileStorage(
  foxhoundProfilePath: string,
  storageItems: StorageItem[]
) {
  updateCookies(
    foxhoundProfilePath,
    storageItems.filter((x): x is Cookie => x.id.storageType === "cookie")
  );
  updateLocalStorageItems(
    foxhoundProfilePath,
    _.toPairs(
      _.groupBy(
        storageItems.filter(
          (x): x is LocalStorageItem => x.id.storageType === "localStorage"
        ),
        ({ id: { origin } }) => origin
      )
    ).map(([origin, storageItems]) => ({ origin, localStorage: storageItems }))
  );
}

/* -------------------------------------------------------------------------- */
/*                               COOKIE UPDATES                                */
/* -------------------------------------------------------------------------- */

function updateCookies(profilePath: string, cookies: Cookie[]) {
  const dbPath = path.join(profilePath, "cookies.sqlite");
  assert(fs.existsSync(dbPath));

  const db = new Database(dbPath);

  const stmt = db.prepare(`
    UPDATE moz_cookies
    SET value = @value
    WHERE name = @name
      AND host = @domain
  `);

  const transaction = db.transaction((items: Cookie[]) => {
    for (const cookie of items) {
      stmt.run({
        name: cookie.id.key,
        value: cookie.value,
        domain: cookie.id.domain,
      });
    }
  });

  transaction(cookies);
  db.close();
}

/* -------------------------------------------------------------------------- */
/*                           LOCAL STORAGE UPDATES                             */
/* -------------------------------------------------------------------------- */

function updateLocalStorageItems(
  profilePath: string,
  origins: { origin: string; localStorage: LocalStorageItem[] }[]
) {
  for (const originEntry of origins) {
    if (!originEntry.localStorage.length) continue;

    const formattedOrigin = formatOrigin(originEntry.origin);
    const dbPath = path.join(
      profilePath,
      "storage",
      "default",
      formattedOrigin,
      "ls",
      "data.sqlite"
    );

    assert(fs.existsSync(dbPath));

    const db = new Database(dbPath);

    const stmt = db.prepare(`
      UPDATE data
      SET value = @value
      WHERE key = @key
    `);

    const transaction = db.transaction((items: LocalStorageItem[]) => {
      for (const item of items) {
        stmt.run({
          key: item.id.key,
          value: item.value,
        });
      }
    });

    transaction(originEntry.localStorage);
    db.close();
  }
}

/* -------------------------------------------------------------------------- */
/*                               ORIGIN FORMATTER                              */
/* -------------------------------------------------------------------------- */
/**
 * Firefox replaces special characters (except dots ".") with "+"
 * Example:
 *   https://example.com:5555 → https+++example.com+5555
 */
function formatOrigin(origin: string): string {
  return origin.replace(/[^A-Za-z0-9.\-]/g, "+");
}
