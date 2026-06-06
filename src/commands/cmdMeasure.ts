import currentTime from "../util/currentTime";
import path from "path";
import { generateReportMD } from "../core/measurement/generateReportMD";
import { generateReportRecord } from "../core/measurement/generateReportRecord";
import { initDisconnect } from "../util/Disconnect";
import { makeDataPath } from "../data/path";
import { readFileSync, writeFileSync } from "fs";
import { TrackingRequestsFile } from "./cmdProcess";

export default async function cmdMeasure(args: {
  processOutDir: string;
  md: boolean;
}) {
  await initDisconnect();

  const { processOutDir } = args;

  const trackingRequestsFile = JSON.parse(
    readFileSync(path.join(processOutDir, "trackingRequests.json")).toString()
  ) as TrackingRequestsFile;

  const reportRecord = generateReportRecord(trackingRequestsFile);

  writeFileSync(
    makeDataPath(
      `${currentTime()}-Report-${path.basename(processOutDir)}.json`
    ),
    JSON.stringify(reportRecord)
  );

  if (args.md) {
    writeFileSync(
      makeDataPath(`${currentTime()}-Report-${path.basename(processOutDir)}.md`),
      generateReportMD(reportRecord)
    );
  }

  process.exit(0);
}
