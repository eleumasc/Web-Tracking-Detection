import _ from "lodash";
import path from "path";
import { BrowserContext, firefox } from "playwright";
import { rootDir, TU_WIEN_MEASUREMENT_ID } from "../env";

const DEFAULT_FOXHOUND_PATH = path.join(rootDir, "foxhound", "foxhound");

export default async function useFoxhound<T>(
  options: {
    userDataDir: string;
    headless?: boolean;
    harPath?: string;
    taintingActive?: boolean;
    foxhoundPath?: string;
  },
  use: (browser: BrowserContext) => Promise<T>
): Promise<T> {
  options = _.defaults(
    { ...options },
    {
      headless: true,
      taintingActive: true,
    }
  );
  const browser = await firefox.launchPersistentContext(options.userDataDir, {
    headless: options.headless,
    executablePath: options.foxhoundPath ?? DEFAULT_FOXHOUND_PATH,
    locale: "en-GB", // request pages in English
    recordHar: options.harPath
      ? {
          path: options.harPath,
          content: "attach",
        }
      : undefined,
    firefoxUserPrefs: {
      "tainting.active": options.taintingActive!,
    },
  });
  if (TU_WIEN_MEASUREMENT_ID) {
    await browser.setExtraHTTPHeaders({
      "X-Research-Measurement": `https://measurements.secpriv.wien/${TU_WIEN_MEASUREMENT_ID}`,
    });
    console.log(`TU Wien Measurement ID: ${TU_WIEN_MEASUREMENT_ID}`);
  } else {
    console.log("WARNING! TU Wien Measurement ID is empty or not found");
  }
  try {
    return await use(browser);
  } finally {
    await browser.close();
  }
}
