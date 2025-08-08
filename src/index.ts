import cmdAnalyze from "./commands/cmdAnalyze";
import cmdLoadSiteList from "./commands/cmdLoadSiteList";
import cmdMeasure from "./commands/cmdMeasure";
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
      "analyze <sites-id>",
      "Create a new login taint analysis",
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

    .command(
      "measure <analysis-id> <src-key> <snk-key>",
      "Perform data processing from a login taint analysis",
      (yargs) =>
        yargs
          .positional("analysis-id", {
            type: "number",
            describe: "ID of the login taint analysis collection",
            demandOption: true,
          })
          .positional("src-key", {
            type: "string",
            demandOption: true,
          })
          .positional("snk-key", {
            type: "string",
            demandOption: true,
          })
          .option("db-filepath", {
            type: "string",
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
