import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { rootDir } from "../env";

export default function writeOutputFileSync(
  filename: string,
  data: string | NodeJS.ArrayBufferView,
  outputDir?: string
): void {
  const filepath = path.join(rootDir, outputDir ?? "output", filename);

  mkdirSync(path.dirname(filename), { recursive: true });

  writeFileSync(filepath, data);
}
