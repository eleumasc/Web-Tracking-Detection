import cmdAnalyze from "./commands/cmdAnalyze";
import cmdMeasure from "./commands/cmdMeasure";
import cmdProcess from "./commands/cmdProcess";
import yargs from "yargs";
import { createStatefulTrackingAnalysis } from "./core/Analysis";
import { hideBin } from "yargs/helpers";

async function main() {
  console.log(`PID: ${process.pid}`);

  yargs(hideBin(process.argv))
    .command(
      "analyze <siteListPath>",
      "Create a new analysis",
      (yargs) =>
        yargs
          .positional("siteListPath", {
            describe: "Path to Tranco site list",
            type: "string",
            demandOption: true,
          })
          .option("noVerif", {
            describe: "Disable the request verification step",
            type: "boolean",
          })
          .option("maxTasks", {
            type: "number",
            default: 1,
          }),
      ({ action, siteListPath, noVerif, ...restArgs }) =>
        cmdAnalyze({
          action: "create",
          siteListPath: siteListPath,
          analysis: createStatefulTrackingAnalysis({ noVerif }),
          ...restArgs,
        })
    )
    .command(
      "analyze:resume <analyzeOutDir>",
      "Resume an existing analysis",
      (yargs) =>
        yargs
          .positional("analyzeOutDir", {
            describe: "Path to data directory of the analysis to resume",
            type: "string",
            demandOption: true,
          })
          .option("maxTasks", {
            type: "number",
            default: 1,
          }),
      ({ action, analyzeOutDir, ...restArgs }) =>
        cmdAnalyze({ action: "resume", analyzeOutDir, ...restArgs })
    )

    .command(
      "process <analyzeOutDir>",
      "Perform data processing from an analysis",
      (yargs) =>
        yargs
          .positional("analyzeOutDir", {
            type: "string",
            describe: "Path to data directory created by analyze command",
            demandOption: true,
          })
          .option("maxTasks", {
            type: "number",
            describe: "Max number of concurrent tasks",
            default: 1,
          })
          .option("forceNoVerif", {
            type: "boolean",
            describe:
              "Pretend that the analysis was initiated using --noVerif (useful to test the canary generation algorithm)",
            default: false,
          }),
      (args) => cmdProcess(args)
    )

    .command(
      "measure <processOutDir>",
      "Measure processed data and generate report",
      (yargs) =>
        yargs.positional("processOutDir", {
          type: "string",
          describe: "Path to data directory created by process command",
          demandOption: true,
        }),
      (args) => cmdMeasure(args)
    )

    .demandCommand(1, "You must provide a valid command.")
    .help()
    .alias("help", "h")
    .version("1.0.0")
    .alias("version", "v")
    .strict().argv;
}

process.on("uncaughtException", (err, origin) => {
  console.error("!!! UNCAUGHT EXCEPTION !!!", err, origin);
});

main();
