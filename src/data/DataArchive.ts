import assert from "assert";
import DB, { Database } from "better-sqlite3";
import { SiteEntry } from "../core/SiteEntry";

export interface DataRecord {
  id: number;
  siteEntry: SiteEntry;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  rank INTEGER NOT NULL,
  data JSON,
  UNIQUE (site)
);

CREATE TABLE IF NOT EXISTS meta (
  name VARCHAR(256) PRIMARY KEY,
  data TEXT NOT NULL
);
`;

export default class DataArchive {
  constructor(readonly db: Database) {}

  static open(dbPath?: string): DataArchive {
    const db = new DB(dbPath);
    db.exec(SCHEMA);
    return new DataArchive(db);
  }

  addRecords(siteEntries: SiteEntry[]): void {
    if (siteEntries.length === 0) return;
    const { db } = this;
    const stmt = db.prepare("INSERT INTO records (site, rank) VALUES (?, ?)");
    db.transaction(() => {
      for (const { name: site, rank } of siteEntries) {
        stmt.run([site, rank]);
      }
    })();
  }

  updateRecordData(recordId: number, data: any): void {
    const { db } = this;
    const stmt = db.prepare("UPDATE records SET data = ? WHERE id = ?");
    stmt.run([JSON.stringify(data), recordId]);
  }

  getRecordData<T>(recordId: number): T {
    const { db } = this;
    const stmt = db.prepare("SELECT data FROM records WHERE id = ?");
    const data = (stmt.get([recordId]) as any)?.data;
    assert(data);
    return JSON.parse(data);
  }

  *getPendingRecords(): IterableIterator<DataRecord> {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, site, rank FROM records WHERE data IS NULL ORDER BY id"
    );
    for (const row of stmt.iterate()) {
      yield _toDataRecord(row);
    }
  }

  *getCompletedRecords(): IterableIterator<DataRecord> {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, site, rank FROM records WHERE data IS NOT NULL ORDER BY id"
    );
    for (const row of stmt.iterate()) {
      yield _toDataRecord(row);
    }
  }

  setMeta(name: string, data: string): void {
    const { db } = this;
    const stmt = db.prepare(
      "INSERT OR REPLACE INTO meta (name, data) VALUES (?, ?)"
    );
    stmt.run([name, data]);
  }

  deleteMeta(name: string): void {
    const { db } = this;
    const stmt = db.prepare("DELETE FROM meta WHERE name = ?");
    stmt.run([name]);
  }

  getMeta(name: string): string | undefined {
    const { db } = this;
    const stmt = db.prepare("SELECT data FROM meta WHERE name = ?");
    return (stmt.get([name]) as any)?.data;
  }
}

function _toDataRecord(row: any): DataRecord {
  const { id, site, rank } = row;
  assert(typeof id === "number");
  assert(typeof site === "string");
  assert(typeof rank === "number");
  return {
    id,
    siteEntry: { name: site, rank },
  };
}
