import Flatted from "flatted";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { inspect } from "util";
import { readFileSync } from "fs";

async function main(args: { filename: string }) {
  const { filename } = args;

  const input = readFileSync(filename, "utf-8");
  if (input) {
    try {
      const parsed = Flatted.parse(input);
      console.log(inspect(parsed, { depth: null, colors: true }));
    } catch (e) {
      console.error(e);
    }
  }

  process.exit(0);
}

const argv = yargs(hideBin(process.argv))
  .option("filename", { type: "string", demandOption: true })
  .parseSync();

main({
  filename: argv.filename,
});
