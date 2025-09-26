import _ from "lodash";
import path from "path";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { rootDir } from "../env";
import { tmpdir } from "os";

export default async function useTempPath<T>(
  options:
    | {
        localTmpDir?: boolean;
      }
    | undefined,
  use: (tempPath: string) => Promise<T>
): Promise<T> {
  options = _.defaults(
    { ...options },
    {
      localTmpDir: false,
    }
  );

  let tmpDir: string;
  if (options.localTmpDir) {
    tmpDir = path.join(rootDir, "tmp");
    mkdirSync(tmpDir, { recursive: true });
  } else {
    tmpDir = tmpdir();
  }

  const tempPath = mkdtempSync(path.join(tmpDir, "node-"));
  try {
    return await use(tempPath);
  } finally {
    rmSync(tempPath, { force: true, recursive: true });
  }
}
