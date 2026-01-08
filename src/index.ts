import cmdAnalyze from "./commands/cmdAnalyze";
import cmdLoadSiteList from "./commands/cmdLoadSiteList";
import cmdMeasure from "./commands/cmdMeasure";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { parseAnalysis } from "./core/Analysis";
import cmdExplain from "./commands/cmdExplain";

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
      (args) => cmdLoadSiteList(args)
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
          .option("analysis", {
            describe: "Analysis descriptor",
            type: "string",
            demandOption: true,
          })
          .option("maxTasks", {
            type: "number",
            default: 1,
          }),
      (args) =>
        cmdAnalyze({
          action: "create",
          ...args,
          analysis: parseAnalysis(args.analysis),
        })
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
      (args) => cmdAnalyze({ action: "resume", ...args })
    )

    .command(
      "measure <analysisId>",
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
          }),
      (args) => cmdMeasure(args)
    )

    .command(
      "explain <measureOutDir>",
      "Explain the results with a pretty MarkDown",
      (yargs) =>
        yargs.positional("measureOutDir", {
          type: "string",
          describe: "Output directory of measure command to explain",
          demandOption: true,
        }),
      (args) => cmdExplain(args)
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
