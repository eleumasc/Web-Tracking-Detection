import path from "path";
import "dotenv/config";

export const rootDir: string = path.resolve(__dirname, "..");

export const tuWienMeasurementId: string | undefined =
  process.env["TU_WIEN_MEASUREMENT_ID"];

export const REAL_USERNAME: string | undefined = process.env["REAL_USERNAME"];
export const REAL_PASSWORD: string | undefined = process.env["REAL_PASSWORD"];
