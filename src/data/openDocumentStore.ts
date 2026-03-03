import DocumentStore from "./DocumentStore";
import path from "path";
import { rootDir } from "../env";

const DB_FILEPATH = path.join(rootDir, "web-tracking-detection.sqlite");

export default function openDocumentStore(dbFilepath?: string): DocumentStore {
  return DocumentStore.open(dbFilepath ?? DB_FILEPATH);
}
