import cmdAnalyze from "./commands/cmdAnalyze";
import cmdLoadSiteList from "./commands/cmdLoadSiteList";
import cmdMeasure from "./commands/cmdMeasure";
import cmdProcess from "./commands/cmdProcess";
import yargs from "yargs";
import { createStatefulTrackingAnalysis } from "./core/Analysis";
import { hideBin } from "yargs/helpers";

async function main() {
  console.log(`PID: ${process.pid}`);

  yargs(hideBin(process.argv))
    .command(
      "load-site-list <pathOrUrl>",
      "Load site list from a Tranco site list",
      (yargs) =>
        yargs.positional("pathOrUrl", {
          describe: "Path or URL to a Tranco site list",
          type: "string",
          demandOption: true,
        }),
      (args) => cmdLoadSiteList(args),
    )

    .command(
      "analyze <sitesId>",
      "Create a new analysis",
      (yargs) =>
        yargs
          .positional("sitesId", {
            describe: "ID of the sites collection",
            type: "number",
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
      ({ action, noVerif, ...restArgs }) =>
        cmdAnalyze({
          action: "create",
          analysis: createStatefulTrackingAnalysis({ noVerif }),
          ...restArgs,
        }),
    )
    .command(
      "analyze:resume <outputId>",
      "Resume an existing analysis",
      (yargs) =>
        yargs
          .positional("outputId", {
            describe: "ID of the analysis to resume",
            type: "number",
            demandOption: true,
          })
          .option("maxTasks", {
            type: "number",
            default: 1,
          }),
      ({ action, outputId, ...restArgs }) =>
        cmdAnalyze({ action: "resume", outputId, ...restArgs }),
    )

    .command(
      "process <analysisId>",
      "Perform data processing from an analysis",
      (yargs) =>
        yargs
          .positional("analysisId", {
            type: "number",
            describe: "ID of the analysis collection",
            demandOption: true,
          })
          .option("maxTasks", {
            type: "number",
            default: 1,
          })
          .option("forceNoVerif", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdProcess(args),
    )

    .command(
      "measure <processOutDir>",
      "Measure processed data and generate report",
      (yargs) =>
        yargs.positional("processOutDir", {
          type: "string",
          describe: "Output directory of process command",
          demandOption: true,
        }),
      (args) => cmdMeasure(args),
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
