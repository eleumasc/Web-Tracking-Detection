import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { rootDir } from "../env";

export const outputDir = path.join(rootDir, "output");

export function writeOutputFileSync(
  filename: string,
  data: string | NodeJS.ArrayBufferView
): void {
  const filepath = getOutputPath(filename);

  writeFileSync(filepath, data);
}

export function getOutputPath(name: string): string {
  const outputPath = path.join(outputDir, name);

  mkdirSync(path.dirname(outputPath), { recursive: true });

  return outputPath;
}
