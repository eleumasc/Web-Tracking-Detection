import path from "path";
import { hostDir, rootDir } from "../env";
import { mkdirSync, mkdtempSync, rmSync } from "fs";

export const tempDir = path.join(rootDir, "temp");

export const tempHostDir = path.join(hostDir, "temp");

export default async function useTempPath<T>(
  use: (tempPath: string, tempHostPath: string) => Promise<T>
): Promise<T> {
  mkdirSync(tempDir, { recursive: true });

  const tempPath = mkdtempSync(path.join(tempDir, "node-"));
  const tempHostPath = path.join(tempHostDir, path.basename(tempPath));
  try {
    return await use(tempPath, tempHostPath);
  } finally {
    rmSync(tempPath, { force: true, recursive: true });
  }
}
