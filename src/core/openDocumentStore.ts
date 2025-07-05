import DocumentStore from "../util/DocumentStore";
import path from "path";
import { rootDir } from "../rootDir";

const DB_FILEPATH = path.join(rootDir, "login-taint-analysis.sqlite");

export default function openDocumentStore(dbFilepath?: string): DocumentStore {
  return DocumentStore.open(dbFilepath ?? DB_FILEPATH);
}
