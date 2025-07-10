import cmdAnalyze from "./commands/cmdAnalyze";
import cmdDetectSPA from "./commands/cmdDetectSPA";
import cmdLoadSiteList from "./commands/cmdLoadSiteList";
import cmdProbe from "./commands/cmdProbe";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function main() {
  console.log(`PID: ${process.pid}`);

  yargs(hideBin(process.argv))
    .command(
      "load-site-list <filepath>",
      "Load site list from a Tranco+SSO list file",
      (yargs) =>
        yargs.positional("filepath", {
          describe: "Path to the file containing the Tranco+SSO list",
          type: "string",
          demandOption: true,
        }),
      ({ filepath }) => cmdLoadSiteList(filepath)
    )

    .command(
      "probe <sites-id>",
      "Create a new probe analysis",
      (yargs) =>
        yargs
          .positional("sites-id", {
            describe: "ID of the sites collection",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdProbe({ action: "create", ...args })
    )
    .command(
      "probe:resume <output-id>",
      "Resume an existing probe analysis",
      (yargs) =>
        yargs
          .positional("output-id", {
            describe: "ID of the analysis to resume",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdProbe({ action: "resume", ...args })
    )

    .command(
      "detect-spa <analysis-id>",
      "Detect SPAs from a probe analysis",
      (yargs) =>
        yargs
          .positional("analysis-id", {
            type: "number",
            describe: "ID of the probe analysis collection",
            demandOption: true,
          })
          .option("db-filepath", {
            type: "string",
          }),
      (args) => cmdDetectSPA(args)
    )

    .command(
      "analyze <probe-id>",
      "Create a new login taint analysis",
      (yargs) =>
        yargs
          .positional("probe-id", {
            describe: "ID of the probe collection",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdAnalyze({ action: "create", ...args })
    )
    .command(
      "analyze:resume <output-id>",
      "Resume an existing login taint analysis",
      (yargs) =>
        yargs
          .positional("output-id", {
            describe: "ID of the analysis to resume",
            type: "number",
            demandOption: true,
          })
          .option("max-tasks", {
            type: "number",
            default: 1,
          })
          .option("no-headless-browser", {
            type: "boolean",
            default: false,
          }),
      (args) => cmdAnalyze({ action: "resume", ...args })
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
