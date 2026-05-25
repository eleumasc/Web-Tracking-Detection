import _ from "lodash";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "fs";
import { TrackingRequestsFile } from "../commands/cmdProcess";

function main(args: { processOutDir: string }) {
  const { processOutDir } = args;

  const trackingRequestsFile = JSON.parse(
    readFileSync(path.join(processOutDir, "trackingRequests.json")).toString()
  ) as TrackingRequestsFile;

  const { entries } = trackingRequestsFile;
  const requests = entries.flatMap((e) => e.trackingRequests);
  const nonMatchingRequests = requests.filter(
    (r) => r.syntacticVerifLabel === "NO_MATCHING_REQUESTS"
  );

  const nonMatchingTrackers = _.uniq(nonMatchingRequests.map((r) => r.tracker));
  let coveredNonMatchingRequests = 0;

  const systematicallyBrokenTrackers: string[] = [];
  for (const targetTracker of nonMatchingTrackers) {
    const targetRequests = requests.filter((r) => r.tracker === targetTracker);
    if (targetRequests.length < 20) continue;

    const targetNonMatchingRequests = nonMatchingRequests.filter(
      (r) => r.tracker === targetTracker
    );

    if (targetNonMatchingRequests.length / targetRequests.length > 0.5) {
      systematicallyBrokenTrackers.push(targetTracker);
      coveredNonMatchingRequests += targetNonMatchingRequests.length;
    }
  }

  console.log(systematicallyBrokenTrackers);
  console.log(coveredNonMatchingRequests);
}

yargs(hideBin(process.argv))
  .command(
    "$0 <processOutDir>",
    "Evaluate systematic breakage",
    (yargs) =>
      yargs.positional("processOutDir", {
        type: "string",
        demandOption: true,
      }),
    (args) => main(args)
  )
  .parse();
