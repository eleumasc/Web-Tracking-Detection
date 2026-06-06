import workerpool from "workerpool";
import { filename as entryFilename } from "./__threadEntry";
import { Task } from "./Task";

export default async function execThread<R>(task: Task): Promise<Awaited<R>> {
  const pool = workerpool.pool(entryFilename, {
    maxWorkers: 1,
  });
  try {
    return await pool.exec("worker", [task]);
  } finally {
    await pool.terminate();
  }
}
