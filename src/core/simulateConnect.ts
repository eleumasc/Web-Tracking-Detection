import { BrowserContext } from "playwright";
import { timeout } from "../util/timeout";

export type SimulateConnectResult = {
  landingPageUrl: string;
};

const NAVIGATE_TIMEOUT_MS: number = 60 * 1000; // 60 seconds

const NAVIGATE_EXTRA_TIMEOUT_MS: number = 10 * 1000; // 10 seconds

export default async function simulateConnect(
  browser: BrowserContext,
  options: {
    site: string;
    screenshotPath?: string;
  }
): Promise<SimulateConnectResult> {
  const { site, screenshotPath } = options;

  const page = await browser.newPage();

  // navigate to landing page
  try {
    await page.goto(`http://${site}/`, {
      timeout: NAVIGATE_TIMEOUT_MS,
    });
  } catch (e) {
    throw new SimulateConnectError(String(e));
  }
  await timeout(NAVIGATE_EXTRA_TIMEOUT_MS);

  const landingPageUrl = page.url();

  // take screenshot
  if (screenshotPath) {
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
  }

  return { landingPageUrl };
}

export class SimulateConnectError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = SimulateConnectError.name;
  }
}
