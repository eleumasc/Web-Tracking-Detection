import workerpool from "workerpool";
import { filename as entryFilename } from "./__threadEntry";
import { Task } from "./Task";
import { TS_NODE_REGISTER_INSTANCE } from "../env";

export default async function execThread<R>(task: Task): Promise<Awaited<R>> {
  const pool = workerpool.pool(entryFilename, {
    maxWorkers: 1,
    workerThreadOpts: {
      execArgv: TS_NODE_REGISTER_INSTANCE
        ? ["--require", "ts-node/register"]
        : undefined,
    },
  });
  try {
    return await pool.exec("worker", [task]);
  } finally {
    await pool.terminate();
  }
}
