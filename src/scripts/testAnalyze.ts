import assert from "assert";
import { REAL_PASSWORD, REAL_USERNAME } from "../data/credentials";
import { runAnalyze } from "../commands/cmdAnalyze";
import { writeFileSync } from "fs";

(async () => {
  assert(REAL_USERNAME && REAL_PASSWORD);

  const result = await runAnalyze(
    {
      name: "pinterest.com",
      rank: -1,
      loginPageCandidates: ["https://www.pinterest.com/"],
    },
    {
      headlessBrowser: false,
      username: REAL_USERNAME,
      password: REAL_PASSWORD,
    }
  );

  writeFileSync("test.json", JSON.stringify(result, undefined, 2));

  process.exit(0);
})();
