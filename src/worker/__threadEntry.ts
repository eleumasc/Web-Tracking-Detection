import worker from "./worker";
import workerpool from "workerpool";
import { isMainThread } from "worker_threads";

export const filename = __filename;

if (!isMainThread) {
  workerpool.worker({ worker });
}
