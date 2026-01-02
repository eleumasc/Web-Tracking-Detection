import currentTime from "../util/currentTime";
import { BrowserContext } from "playwright";
import { StorageState } from "./StorageState";
import { timeout } from "../util/timeout";

export type SimulateConnectResult = {
  landingPageUrl: string;
  storageState: StorageState;
  timestamp: number;
};

const LOAD_TIMEOUT_MS: number = 60 * 1000; // 60 seconds
const WAIT_AFTER_LOAD_MS: number = 10 * 1000; // 10 seconds

export default async function simulateConnect(
  browser: BrowserContext,
  options: {
    siteName: string;
    screenshotPath?: string;
  }
): Promise<SimulateConnectResult> {
  const { siteName, screenshotPath } = options;

  const timestamp = currentTime();

  const page = await browser.newPage();
  try {
    // navigate to landing page
    try {
      await page.goto(`http://${siteName}/`, {
        timeout: LOAD_TIMEOUT_MS,
      });
    } catch (e) {
      throw new SimulateConnectError(String(e));
    }
    await timeout(WAIT_AFTER_LOAD_MS);

    const landingPageUrl = page.url();

    // take screenshot
    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath });
    }

    // trigger late requests for capturing
    try {
      await page.goto("about:blank");
    } catch {}

    const storageState = await browser.storageState();

    return {
      landingPageUrl,
      storageState,
      timestamp,
    };
  } finally {
    await page.close();
  }
}

export class SimulateConnectError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = SimulateConnectError.name;
  }
}
