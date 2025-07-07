import path from "path";
import "dotenv/config";

export const rootDir: string = path.resolve(__dirname, "..");

export const tuWienMeasurementId: string | undefined =
  process.env["TU_WIEN_MEASUREMENT_ID"];
