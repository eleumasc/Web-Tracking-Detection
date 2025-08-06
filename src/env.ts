import path from "path";
import "dotenv/config";

export const rootDir: string = path.resolve(__dirname, "..");

export const TU_WIEN_MEASUREMENT_ID: string | undefined =
  process.env["TU_WIEN_MEASUREMENT_ID"];
