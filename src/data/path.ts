import assert from "assert";
import path from "path";
import { hostDir, rootDir } from "../env";

export const dataDir = path.join(rootDir, "data");

export const dataHostDir = path.join(hostDir, "data");

export function makeDataPath(...names: string[]): string {
  return path.join(dataDir, ...names);
}

export function extractDataPath(targetPath: string): string {
  targetPath = path.resolve(targetPath);
  const dataName = path.relative(dataDir, targetPath);
  assert(
    dataName !== "" && !dataName.startsWith("..") && !path.isAbsolute(dataName)
  );
  return dataName;
}
