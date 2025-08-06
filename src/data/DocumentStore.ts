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

  static open(dbFilepath?: string): DocumentStore {
    const db = new DB(dbFilepath);
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
    return this.getCollectionById(id);
  }

  importCollection(src: Collection): Collection {
    const { id, parentId, name, meta } = src;
    const { db } = this;
    const stmt = db.prepare(
      "INSERT INTO collections (id, parent, name, meta) VALUES (?, ?, ?, ?)"
    );
    const insertedId = stmt.run([
      id,
      parentId,
      name,
      meta ? JSON.stringify(meta) : null,
    ]).lastInsertRowid as number;
    return this.getCollectionById(insertedId);
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
    return this.getDocumentById(id);
  }

  importDocument(src: Document, data: any): Document {
    const { id, collectionId, name } = src;
    const { db } = this;
    const stmt = db.prepare(
      "INSERT INTO documents (id, collection, name, data) VALUES (?, ?, ?, ?)"
    );
    const insertedId = stmt.run([id, collectionId, name, JSON.stringify(data)])
      .lastInsertRowid as number;
    return this.getDocumentById(insertedId);
  }

  getDocumentData(documentId: number): any {
    const { db } = this;
    const stmt = db.prepare("SELECT data FROM documents WHERE id = ?");
    const row = stmt.get([documentId]);
    if (!row) {
      throw new Error(`Document with ID ${documentId} does not exist`);
    }
    const { data } = row as any;
    assert(typeof data === "string");
    return JSON.parse(data);
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
