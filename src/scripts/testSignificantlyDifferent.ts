import significantlyDifferent from "../core/identifierDetection/significantlyDifferent";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main(args: { str1: string; str2: string }) {
  const { str1, str2 } = args;

  console.log(str1, str2, significantlyDifferent(str1, str2));

  process.exit(0);
}

yargs(hideBin(process.argv))
  .command(
    "$0 <str1> <str2>",
    "Test significantlyDifferent",
    (yargs) =>
      yargs
        .positional("str1", {
          type: "string",
          demandOption: true,
        })
        .positional("str2", {
          type: "string",
          demandOption: true,
        }),
    (args) => main(args),
  )
  .parse();
