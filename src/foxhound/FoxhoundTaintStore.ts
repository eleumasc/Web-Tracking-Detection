import DocumentStore, { Collection } from "../data/DocumentStore";
import { FoxhoundReport } from "./types";

export const TAINT_REPORTS_COLL_NAME = "taintReports";

export default class FoxhoundTaintStore {
  constructor(readonly store: DocumentStore, readonly collection: Collection) {}

  getReports(): FoxhoundReport[] {
    return this.store
      .getDocumentsWithDataByCollection(this.collection.id)
      .map(({ data }) => data as FoxhoundReport);
  }

  insertReports(
    entries: { serial: number; foxhoundReport: FoxhoundReport }[]
  ): void {
    this.store.insertDocuments(
      this.collection.id,
      entries.map(({ serial, foxhoundReport }) => ({
        name: `${serial}`,
        data: foxhoundReport,
      }))
    );
  }

  static open(dbPath: string): FoxhoundTaintStore {
    const store = DocumentStore.open(dbPath);

    let collection = store.findCollectionByName(null, TAINT_REPORTS_COLL_NAME);
    if (!collection) {
      collection = store.createCollection(null, TAINT_REPORTS_COLL_NAME, null);
    }

    return new FoxhoundTaintStore(store, collection);
  }
}
