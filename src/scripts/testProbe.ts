import currentTime from "../util/currentTime";
import writeOutputFileSync from "../core/writeOutputFileSync";
import { runProbe } from "../commands/cmdProbe";

(async () => {
  const result = await runProbe(
    {
      name: "pinterest.com",
      rank: -1,
      loginPageCandidates: ["https://www.pinterest.com/"],
    },
    {
      headlessBrowser: false,
    }
  );

  writeOutputFileSync(
    `testProbe-${currentTime()}.json`,
    JSON.stringify(result, undefined, 2)
  );

  process.exit(0);
})();
