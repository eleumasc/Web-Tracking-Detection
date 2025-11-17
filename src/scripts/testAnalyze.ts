import currentTime from "../util/currentTime";
import execContainer from "../worker/execContainer";
import { makeTaskFromFunction } from "../worker/Task";
import { runAnalyze } from "../commands/cmdAnalyze";
import { toFlatCompletion } from "../util/Completion";

async function main(args: { siteName: string }) {
  const completion = await toFlatCompletion(() =>
    execContainer<ReturnType<typeof runAnalyze>>(
      makeTaskFromFunction(runAnalyze, [
        args.siteName,
        {
          outputName: `${currentTime()}-testAnalyze`,
        },
      ])
    )
  );

  console.log(completion);

  process.exit(0);
}

main({
  siteName: process.argv[2],
});
