import { runAnalyze } from "../commands/cmdAnalyze";
import { writeFileSync } from "fs";

(async () => {
  const result = await runAnalyze(
    {
      name: "pinterest.com",
      rank: -1,
      loginPageCandidates: ["https://www.pinterest.com/"],
    },
    {
      headlessBrowser: false,
    }
  );

  writeFileSync("test.json", JSON.stringify(result, undefined, 2));

  process.exit(0);
})();
