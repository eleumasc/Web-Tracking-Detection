import useTempPath from "../util/useTempPath";
import { BrowserContext, firefox } from "playwright";
import { FOXHOUND_PATH, TU_WIEN_MEASUREMENT_ID } from "../env";

let firstCall = true;

export default async function useFoxhound<T>(
  options: {
    headless?: boolean;
    harPath?: string;
  },
  use: (browser: BrowserContext) => Promise<T>
): Promise<T> {
  return useTempPath({}, async (userDataDir) => {
    const browser = await firefox.launchPersistentContext(userDataDir, {
      headless: options.headless ?? true,
      executablePath: FOXHOUND_PATH,
      locale: "en-GB", // request pages in English
      recordHar: options.harPath
        ? {
            path: options.harPath,
            content: "attach",
          }
        : undefined,
    });
    if (TU_WIEN_MEASUREMENT_ID) {
      await browser.setExtraHTTPHeaders({
        "X-Research-Measurement": `https://measurements.secpriv.wien/${TU_WIEN_MEASUREMENT_ID}`,
      });
      if (firstCall)
        console.log(`TU Wien Measurement ID: ${TU_WIEN_MEASUREMENT_ID}`);
    } else {
      if (firstCall)
        console.log("WARNING! TU Wien Measurement ID is empty or not found");
    }
    firstCall = false;
    try {
      return await use(browser);
    } finally {
      await browser.close();
    }
  });
}
