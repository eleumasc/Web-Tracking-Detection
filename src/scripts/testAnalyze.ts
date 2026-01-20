import currentTime from "../util/currentTime";
import execContainer from "../worker/execContainer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { makeTaskFromFunction } from "../worker/Task";
import { runAnalyze } from "../core/runAnalyze";
import { toFlatCompletion } from "../util/Completion";

async function main(args: { site: string }) {
  const { site } = args;

  const completion = await toFlatCompletion(() =>
    execContainer<ReturnType<typeof runAnalyze>>(
      makeTaskFromFunction(runAnalyze, [
        {
          site,
          outputName: `${currentTime()}-testAnalyze`,
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

const argv = yargs(hideBin(process.argv))
  .option("site", { type: "string", demandOption: true })
  .parseSync();

main({
  site: argv.site,
});
