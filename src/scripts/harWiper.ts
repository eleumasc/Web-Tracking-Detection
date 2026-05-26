import AdmZip from "adm-zip";
import path from "path";
import yargs from "yargs";
import { Har } from "har-format";
import { hideBin } from "yargs/helpers";
import { readdirSync, statSync } from "fs";

function extractReferencedFiles(har: Har) {
  const reqFiles = new Set<string>();
  const resFiles = new Set<string>();

  for (const entry of har.log.entries) {
    const { postData } = entry.request;
    if (postData && "_file" in postData) {
      const reqFile = postData._file as string;
      reqFiles.add(reqFile);
    }

    const { content } = entry.response;
    if (content && "_file" in content) {
      const resFile = content._file as string;
      resFiles.add(resFile);
    }
  }

  return { reqFiles, resFiles };
}

function stripResponseOnlyFilesFromHarZip(
  inputZipPath: string,
  outputZipPath: string
) {
  const zip = new AdmZip(inputZipPath);

  const harEntry = zip.getEntry("har.har");
  if (!harEntry) {
    throw new Error("har.har not found in archive");
  }

  const har: Har = JSON.parse(harEntry.getData().toString("utf-8"));

  const { reqFiles, resFiles } = extractReferencedFiles(har);

  const removableFiles = new Set([...resFiles].filter((f) => !reqFiles.has(f)));

  const outZip = new AdmZip();

  outZip.addFile("har.har", harEntry.getData());

  for (const entry of zip.getEntries()) {
    if (entry.entryName === "har.har") continue;

    const normalized = entry.entryName.replace(/^\.?\//, "");

    if (removableFiles.has(normalized)) {
      continue;
    }

    outZip.addFile(entry.entryName, entry.getData());
  }

  outZip.writeZip(outputZipPath);
}

function isHarZipFile(file: string) {
  return file.toLowerCase().endsWith(".har.zip");
}

function main(args: { inputDir: string }) {
  const { inputDir } = args;

  const files = readdirSync(inputDir);

  for (const file of files) {
    const fullPath = path.join(inputDir, file);

    const stat = statSync(fullPath);
    if (!stat.isFile()) continue;

    if (!isHarZipFile(file)) continue;

    const parsed = path.parse(file);

    const outputName = `${parsed.name}.new.zip`;
    const outputPath = path.join(inputDir, outputName);

    try {
      stripResponseOnlyFilesFromHarZip(fullPath, outputPath);
      console.log(`Processed: ${file} -> ${outputName}`);
    } catch (err) {
      console.error(`Failed processing ${file}:`, err);
    }
  }
}

yargs(hideBin(process.argv))
  .command(
    "$0 <inputDir>",
    "Wipe (zipped) HAR files from unused entries",
    (yargs) =>
      yargs.positional("inputDir", {
        type: "string",
        demandOption: true,
      }),
    (args) => main(args)
  )
  .parse();
