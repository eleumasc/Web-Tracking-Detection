import path from "path";
import useTempPath from "./useTempPath";
import { BrowserContext, firefox } from "playwright";
import { rootDir } from "../rootDir";

const FOXHOUND_PATH: string = path.join(rootDir, "foxhound", "foxhound");

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
    try {
      return await use(browser);
    } finally {
      await browser.close();
    }
  });
}
