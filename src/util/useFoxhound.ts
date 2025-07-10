import path from "path";
import useTempPath from "./useTempPath";
import { BrowserContext, firefox } from "playwright";
import { rootDir, TU_WIEN_MEASUREMENT_ID } from "../env";

export const FOXHOUND_PATH: string = path.join(rootDir, "foxhound", "foxhound");

let firstCall = true;

export default async function useFoxhound<T>(
  options: { headless?: boolean },
  use: (browser: BrowserContext) => Promise<T>
): Promise<T> {
  return useTempPath({}, async (userDataDir) => {
    const browser = await firefox.launchPersistentContext(userDataDir, {
      headless: options.headless ?? true,
      executablePath: FOXHOUND_PATH,
      locale: "en-GB", // request pages in English
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
