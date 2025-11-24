import path from "path";
import useFoxhound from "../foxhound/useFoxhound";
import { forever } from "../util/timeout";
import useTempPath from "../util/useTempPath";
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

main({
  foxhoundPath: path.resolve(process.argv[2]),
});
