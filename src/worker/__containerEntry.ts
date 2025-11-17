import assert from "assert";
import path from "path";
import worker from "./worker";
import { Completion, Failure, Success } from "../util/Completion";
import { readFileSync, writeFileSync } from "fs";
import { Task } from "./Task";

(async function () {
  const ipcDir = process.env["IPCDIR"];
  assert(ipcDir, "IPCDIR env variable is empty or not found");

  const task = JSON.parse(
    readFileSync(path.join(ipcDir, "request")).toString()
  ) as Task;

  let completion: Completion<any>;
  try {
    const result = await worker(task);
    completion = Success(result);
  } catch (e) {
    completion = Failure.from(e);
  }

  writeFileSync(path.join(ipcDir, "reply"), JSON.stringify(completion));

  process.exit(0);
})();
