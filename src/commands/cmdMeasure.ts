import currentTime from "../util/currentTime";
import path from "path";
import { generateAEMD } from "../core/measurement/generateAEMD";
import { generateReportRecord } from "../core/measurement/generateReportRecord";
import { initDisconnect } from "../util/Disconnect";
import { makeDataPath } from "../data/path";
import { readFileSync, writeFileSync } from "fs";
import { TrackingRequestsFile } from "./cmdProcess";

export default async function cmdMeasure(args: {
  processOutDir: string;
  ae: boolean;
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

  if (args.ae) {
    writeFileSync(
      makeDataPath(`${currentTime()}-AE-${path.basename(processOutDir)}.md`),
      generateAEMD(reportRecord)
    );
  }

  process.exit(0);
}
