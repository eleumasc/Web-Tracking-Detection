import currentTime from "../util/currentTime";
import execThread from "../worker/execThread";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { makeTaskFromFunction } from "../worker/Task";
import { runAnalyze } from "../core/runAnalyze";
import { toFlatCompletion } from "../util/Completion";

async function main(args: { site: string }) {
  const { site } = args;

  const completion = await toFlatCompletion(() =>
    execThread<ReturnType<typeof runAnalyze>>(
      makeTaskFromFunction(runAnalyze, [
        {
          site,
          dataName: `${currentTime()}-testAnalyze`,
          analysis: {
            type: "StatefulTracking",
            noVerif: false,
          },
        },
      ])
    )
  );

  console.log(completion);

  process.exit(0);
}

yargs(hideBin(process.argv))
  .command(
    "$0 <site>",
    "Test runAnalyze",
    (yargs) =>
      yargs.positional("site", {
        type: "string",
        demandOption: true,
      }),
    (args) => main(args)
  )
  .parse();
