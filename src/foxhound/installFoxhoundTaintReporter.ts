import path from "path";
import { BrowserContext, Page } from "playwright";
import { rootDir } from "../env";

export default async function installFoxhoundTaintReporter(
  context: BrowserContext | Page,
  options: {
    onReport: (rawReport: string) => void;
  },
): Promise<void> {
  const { onReport } = options;

  await context.addInitScript({
    path: path.resolve(rootDir, "setup", "foxhoundTaintReporter.js"),
  });

  await context.exposeBinding(
    "__foxhoundTaintReporter",
    async (_source, rawReport: string) => {
      onReport(rawReport);
    },
  );
}
