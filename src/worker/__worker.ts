import assert from "assert";
import path from "path";
import { Completion, Failure, Success } from "../util/Completion";
import { MP_FUNCTIONS } from "./functions";
import { readFileSync, writeFileSync } from "fs";

(async () => {
  const ipcDir = process.env["WORKER_IPCDIR"];
  assert(ipcDir, "WORKER_IPCDIR env variable is empty or not found");

  const request = JSON.parse(
    readFileSync(path.join(ipcDir, "request")).toString()
  );
  const { func: funcName, args } = request as { func: string; args: any[] };

  let reply: Completion<any>;
  try {
    const func = MP_FUNCTIONS[funcName];
    if (!func) {
      throw new ReferenceError(
        `${funcName} is not defined in worker/functions`
      );
    }

    const result = await Reflect.apply(func, undefined, args);
    reply = Success(result);
  } catch (e) {
    reply = Failure.from(e);
  }

  writeFileSync(path.join(ipcDir, "reply"), JSON.stringify(reply));

  process.exit(0);
})();
