import _ from "lodash";
import path from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

export default async function useTempPath<T>(
  options: {
    removeAtEnd?: boolean;
  },
  use: (tempPath: string) => Promise<T>
): Promise<T> {
  options = _.defaults(
    { ...options },
    {
      removeAtEnd: true,
    }
  );

  const tempPath = mkdtempSync(path.join(tmpdir(), "node-"));
  const removeTempPath = () => {
    rmSync(tempPath, { force: true, recursive: true });
  };

  const exitHandler = () => {
    removeTempPath();
  };
  if (options.removeAtEnd) {
    process.addListener("exit", exitHandler);
  }

  try {
    return await use(tempPath);
  } finally {
    if (options.removeAtEnd) {
      process.removeListener("exit", exitHandler);
      removeTempPath();
    }
  }
}
