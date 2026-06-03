import DB, { Database } from "better-sqlite3";
import { FoxReport } from "./types";
import { unCompact } from "../util/unCompact";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data JSON
);
`;

export default class FoxTaintArchive {
  constructor(readonly db: Database) {}

  static open(dbPath?: string): FoxTaintArchive {
    const db = new DB(dbPath);
    db.exec(SCHEMA);
    return new FoxTaintArchive(db);
  }

  addRawReports(rawReports: any[]): void {
    if (rawReports.length === 0) return;
    const { db } = this;
    const stmt = db.prepare("INSERT INTO reports (data) VALUES (?)");
    db.transaction(() => {
      for (const rawReport of rawReports) {
        stmt.run([JSON.stringify(rawReport)]);
      }
    })();
  }

  *getReports(): IterableIterator<FoxReport> {
    const { db } = this;
    const stmt = db.prepare("SELECT data FROM reports ORDER BY id");
    for (const row of stmt.iterate()) {
      const { data } = row as any;
      yield unCompact(JSON.parse(data)) as FoxReport;
    }
  }
}
