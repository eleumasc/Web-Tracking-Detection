import DocumentStore from "../data/DocumentStore";
import { FoxhoundReport } from "./types";

export const TAINT_REPORTS_COLL_NAME = "taintReports";

export default class FoxhoundTaintArchive {
  constructor(readonly dbPath: string) {}

  getReports(): FoxhoundReport[] {
    const store = DocumentStore.open(this.dbPath);
    try {
      const collection = store.getCollectionByName(
        null,
        TAINT_REPORTS_COLL_NAME
      );
      return store
        .getDocumentsWithDataByCollection(collection.id)
        .map(({ data }) => data as FoxhoundReport);
    } finally {
      store.db.close();
    }
  }

  insertReports(foxhoundReports: FoxhoundReport[]): void {
    const store = DocumentStore.open(this.dbPath);
    try {
      const collection = store.createCollection(null, TAINT_REPORTS_COLL_NAME);
      store.insertDocuments(
        collection.id,
        foxhoundReports.map((foxhoundReport, i) => ({
          name: `${i}`,
          data: foxhoundReport,
        }))
      );
    } finally {
      store.db.close();
    }
  }
}
