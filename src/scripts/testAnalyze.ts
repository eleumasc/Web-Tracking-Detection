import currentTime from "../util/currentTime";
import execWorker from "../worker/execWorker";
import { runAnalyze } from "../commands/cmdAnalyze";
import { SiteEntry } from "../core/SiteEntry";
import { toFlatCompletion } from "../util/Completion";

async function main(args: { siteName: string }) {
  const siteEntry: SiteEntry = { name: args.siteName, rank: 1 };

  const completion = await toFlatCompletion(() =>
    execWorker(runAnalyze, [
      siteEntry,
      {
        headlessBrowser: true,
        outputName: `${currentTime()}-testAnalyze`,
      },
    ])
  );

  console.log(completion);

  process.exit(0);
}

main({
  siteName: process.argv[2],
});
