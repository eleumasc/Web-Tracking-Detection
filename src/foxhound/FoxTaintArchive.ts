import DocumentStore from "../data/DocumentStore";
import { FoxReport } from "./types";
import { unCompact } from "../util/unCompact";

export const TAINT_REPORTS_COLL_NAME = "taintReports";

export default class FoxTaintArchive {
  constructor(readonly dbPath: string) {}

  getReports(): FoxReport[] {
    const store = DocumentStore.open(this.dbPath);
    try {
      const collection = store.getCollectionByName(
        null,
        TAINT_REPORTS_COLL_NAME,
      );
      return store
        .getDocumentsWithDataByCollection(collection.id)
        .map(({ data }) => unCompact(data) as FoxReport);
    } finally {
      store.db.close();
    }
  }

  insertRawReports(rawReports: any[]): void {
    const store = DocumentStore.open(this.dbPath);
    try {
      const collection = store.createCollection(null, TAINT_REPORTS_COLL_NAME);
      store.insertDocuments(
        collection.id,
        rawReports.map((rawReport, i) => ({
          name: `${i}`,
          data: rawReport,
        })),
      );
    } finally {
      store.db.close();
    }
  }
}
