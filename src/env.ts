import path from "path";
import "dotenv/config";

export const rootDir: string = path.resolve(__dirname, "..");

export const hostDir: string = process.env["WTD_HOST_DIR"] || rootDir;

export const TU_WIEN_MEASUREMENT_ID: string | undefined =
  process.env["TU_WIEN_MEASUREMENT_ID"];

export const DOCKER_IMAGE: string | undefined = process.env["DOCKER_IMAGE"];

export const DOCKER_NET: string | undefined = process.env["DOCKER_NET"];
