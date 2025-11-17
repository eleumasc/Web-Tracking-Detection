import assert from "assert";
import DB, { Database } from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent INTEGER,
  name TEXT NOT NULL,
  meta JSON,

  UNIQUE (id, name),
  FOREIGN KEY (parent) REFERENCES collections (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection INTEGER NOT NULL,
  name TEXT NOT NULL,
  data JSON NOT NULL,

  UNIQUE (collection, name),
  FOREIGN KEY (collection) REFERENCES collections (id) ON DELETE CASCADE
);
`;

export default class DocumentStore {
  constructor(readonly db: Database) {}

  static open(dbPath?: string): DocumentStore {
    const db = new DB(dbPath);
    db.exec(SCHEMA);
    return new DocumentStore(db);
  }

  createCollection(
    parentId: number | null,
    name: string,
    meta?: any
  ): Collection {
    const { db } = this;
    const stmt = db.prepare(
      "INSERT INTO collections (parent, name, meta) VALUES (?, ?, ?)"
    );
    const id = stmt.run([parentId, name, meta ? JSON.stringify(meta) : null])
      .lastInsertRowid as number;
    return { id, parentId, name, meta };
  }

  getCollectionById(id: number): Collection {
    const { db } = this;
    const stmt = db.prepare("SELECT * FROM collections WHERE id = ?");
    const row = stmt.get([id]);
    if (!row) {
      throw new Error(`Collection with ID ${id} does not exist`);
    }
    return _toCollection(row);
  }

  findCollectionById(id: number): Collection | undefined {
    try {
      return this.getCollectionById(id);
    } catch {
      return;
    }
  }

  getCollectionByName(parentId: number | null, name: string): Collection {
    const { db } = this;
    let row;
    if (parentId !== null) {
      const stmt = db.prepare(
        "SELECT * FROM collections WHERE parent = ? AND name = ?"
      );
      row = stmt.get([parentId, name]);
    } else {
      const stmt = db.prepare(
        "SELECT * FROM collections WHERE parent IS NULL AND name = ?"
      );
      row = stmt.get([name]);
    }
    if (!row) {
      throw new Error(
        `Collection with name '${name}' does not exist in collection with ID ${parentId}`
      );
    }
    return _toCollection(row);
  }

  findCollectionByName(
    parentId: number | null,
    name: string
  ): Collection | undefined {
    try {
      return this.getCollectionByName(parentId, name);
    } catch {
      return;
    }
  }

  getAllCollections(): Collection[] {
    const { db } = this;
    const stmt = db.prepare("SELECT * FROM collections ORDER BY id");
    const rows = stmt.all();
    return rows.map((row) => _toCollection(row));
  }

  createDocument(collectionId: number, name: string, data: any): Document {
    const { db } = this;
    const stmt = db.prepare(
      "INSERT INTO documents (collection, name, data) VALUES (?, ?, ?)"
    );
    const id = stmt.run([collectionId, name, JSON.stringify(data)])
      .lastInsertRowid as number;
    return { id, collectionId, name };
  }

  insertDocuments(
    collectionId: number,
    entries: { name: string; data: any }[]
  ): void {
    if (entries.length === 0) return;
    const { db } = this;
    const stmt = db.prepare(
      `INSERT INTO documents (collection, name, data) VALUES ${Array(
        entries.length
      )
        .fill("(?, ?, ?)")
        .join(", ")}`
    );
    stmt.run(
      entries.flatMap(({ name, data }) => [
        collectionId,
        name,
        JSON.stringify(data),
      ])
    );
  }

  getDocumentData<T = any>(documentId: number): T {
    const { db } = this;
    const stmt = db.prepare("SELECT data FROM documents WHERE id = ?");
    const row = stmt.get([documentId]);
    if (!row) {
      throw new Error(`Document with ID ${documentId} does not exist`);
    }
    const { data } = row as any;
    return JSON.parse(data);
  }

  updateDocumentData(documentId: number, data: any): void {
    const { db } = this;
    const stmt = db.prepare("UPDATE documents SET data = ? WHERE id = ?");
    stmt.run([JSON.stringify(data), documentId]);
  }

  getDocumentById(id: number): Document {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, collection, name FROM documents WHERE id = ?"
    );
    const row = stmt.get([id]);
    if (!row) {
      throw new Error(`Document with ID ${id} does not exist`);
    }
    return _toDocument(row);
  }

  findDocumentById(id: number): Document | undefined {
    try {
      return this.getDocumentById(id);
    } catch {
      return;
    }
  }

  getDocumentByName(collectionId: number, name: string): Document {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, collection, name FROM documents WHERE collection = ? AND name = ?"
    );
    const row = stmt.get([collectionId, name]);
    if (!row) {
      throw new Error(
        `Document with name '${name}' does not exist in collection with ID ${collectionId}`
      );
    }
    return _toDocument(row);
  }

  findDocumentByName(collectionId: number, name: string): Document | undefined {
    try {
      return this.getDocumentByName(collectionId, name);
    } catch {
      return;
    }
  }

  getDocumentsByCollection(collectionId: number): Document[] {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, collection, name FROM documents WHERE collection = ? ORDER BY id"
    );
    const rows = stmt.all([collectionId]);
    return rows.map((row) => _toDocument(row));
  }

  getDocumentsWithDataByCollection<T = any>(
    collectionId: number
  ): DocumentDataEntry<T>[] {
    const { db } = this;
    const stmt = db.prepare(
      "SELECT id, collection, name, data FROM documents WHERE collection = ? ORDER BY id"
    );
    const rows = stmt.all([collectionId]);
    return rows.map((row) => {
      const { data } = row as any;
      return {
        document: _toDocument(row),
        data: JSON.parse(data),
      };
    });
  }
}

export interface Collection {
  id: number;
  parentId: number | null;
  name: string;
  meta: any;
}

function _toCollection(row: any): Collection {
  const { id, parent: parentId, name, meta } = row;
  assert(typeof id === "number");
  assert(typeof parentId === "number" || parentId === null);
  assert(typeof name === "string");
  assert(typeof meta === "string" || meta === null);
  return { id, parentId, name, meta: meta ? JSON.parse(meta) : null };
}

export interface Document {
  id: number;
  collectionId: number;
  name: string;
}

function _toDocument(row: any): Document {
  const { id, collection: collectionId, name } = row;
  assert(typeof id === "number");
  assert(typeof collectionId === "number");
  assert(typeof name === "string");
  return { id, collectionId, name };
}

export interface DocumentDataEntry<T> {
  document: Document;
  data: T;
}
