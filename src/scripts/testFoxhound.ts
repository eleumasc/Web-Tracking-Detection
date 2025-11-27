import path from "path";
import useFoxhound from "../foxhound/useFoxhound";
import useTempPath from "../util/useTempPath";
import yargs from "yargs";
import { forever } from "../util/timeout";
import { hideBin } from "yargs/helpers";
import { rootDir } from "../env";

async function main(args: { foxhoundPath: string }) {
  const { foxhoundPath } = args;

  await useTempPath(undefined, (userDataDir) =>
    useFoxhound(
      {
        userDataDir,
        headless: false,
        foxhoundPath,
      },
      async (browser) => {
        await browser.addInitScript({
          path: path.resolve(rootDir, "setup", "foxhoundTaintReporter.js"),
        });

        await forever();
      }
    )
  );

  process.exit(0);
}

const argv = yargs(hideBin(process.argv))
  .option("foxhoundPath", { type: "string", demandOption: true })
  .parseSync();

main({
  foxhoundPath: path.resolve(argv.foxhoundPath),
});
