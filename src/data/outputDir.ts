import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { rootDir } from "../env";

export const outputDir = path.join(rootDir, "output");

export function writeOutputFileSync(
  filename: string,
  data: string | NodeJS.ArrayBufferView
): void {
  createOutputDir(path.dirname(filename));

  writeFileSync(getOutputPath(filename), data);
}

export function createOutputDir(name: string): string {
  const outputPath = path.join(outputDir, name);

  mkdirSync(outputPath, { recursive: true });

  return outputPath;
}

export function getOutputPath(name: string): string {
  return path.join(outputDir, name);
}
