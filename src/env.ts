import path from "path";
import "dotenv/config";

export const rootDir: string = path.resolve(__dirname, "..");

export const hostDir: string = process.env["WTD_HOST_DIR"] || rootDir;

export const TS_NODE_REGISTER_INSTANCE = Boolean(
  // @ts-ignore
  process[Symbol.for("ts-node.register.instance")]
);

export const TU_WIEN_MEASUREMENT_ID: string | undefined =
  process.env["TU_WIEN_MEASUREMENT_ID"];

export const DOCKER_IMAGE: string | undefined = process.env["DOCKER_IMAGE"];
