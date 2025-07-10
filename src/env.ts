import path from "path";
import "dotenv/config";

export const rootDir: string = path.resolve(__dirname, "..");

export const TU_WIEN_MEASUREMENT_ID: string | undefined =
  process.env["TU_WIEN_MEASUREMENT_ID"];

export const BITWARDEN_EXPORT_FILENAME: string | undefined =
  process.env["BITWARDEN_EXPORT_FILENAME"];
