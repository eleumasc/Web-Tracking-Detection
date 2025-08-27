import path from "path";
import "dotenv/config";

export const rootDir: string = path.resolve(__dirname, "..");

export const FOXHOUND_PATH: string | undefined = process.env["FOXHOUND_PATH"];
