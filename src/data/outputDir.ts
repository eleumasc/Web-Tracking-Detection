import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { rootDir } from "../env";

export function writeOutputFileSync(
  filename: string,
  data: string | NodeJS.ArrayBufferView
): void {
  const filepath = getOutputPath(filename);

  writeFileSync(filepath, data);
}

export function getOutputPath(name: string): string {
  const outputPath = path.join(rootDir, "output", name);

  mkdirSync(path.dirname(outputPath), { recursive: true });

  return outputPath;
}
