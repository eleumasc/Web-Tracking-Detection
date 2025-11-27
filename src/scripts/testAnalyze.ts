import currentTime from "../util/currentTime";
import execContainer from "../worker/execContainer";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { makeTaskFromFunction } from "../worker/Task";
import { runAnalyze } from "../core/runAnalyze";
import { toFlatCompletion } from "../util/Completion";

async function main(args: { siteName: string }) {
  const { siteName } = args;

  const completion = await toFlatCompletion(() =>
    execContainer<ReturnType<typeof runAnalyze>>(
      makeTaskFromFunction(runAnalyze, [
        {
          siteName,
          outputName: `${currentTime()}-testAnalyze`,
          analysis: { type: "StatefulTracking" },
        },
      ])
    )
  );

  console.log(completion);

  process.exit(0);
}

const argv = yargs(hideBin(process.argv))
  .option("siteName", { type: "string", demandOption: true })
  .parseSync();

main({
  siteName: argv.siteName,
});
