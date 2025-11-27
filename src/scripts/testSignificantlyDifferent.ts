import significantlyDifferent from "../core/chen/significantlyDifferent";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main(args: { str1: string; str2: string }) {
  const { str1, str2 } = args;

  console.log(str1, str2, significantlyDifferent(str1, str2));

  process.exit(0);
}

const argv = yargs(hideBin(process.argv))
  .option("str1", { type: "string", demandOption: true })
  .option("str2", { type: "string", demandOption: true })
  .parseSync();

main({
  str1: argv.str1,
  str2: argv.str2,
});
