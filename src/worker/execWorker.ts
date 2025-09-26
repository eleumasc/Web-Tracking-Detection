import assert from "assert";
import Docker from "dockerode";
import path from "path";
import useTempPath from "../util/useTempPath";
import { Completion, isSuccess } from "../util/Completion";
import { outputDir } from "../data/outputDir";
import { readFileSync, writeFileSync } from "fs";
import { WORKER_DOCKER_IMAGE } from "../env";
import { WorkerError } from "./errors";

export default async function execWorker<A extends any[], R>(
  func: (...args: A) => R,
  [...args]: A
): Promise<Awaited<R>> {
  assert(
    WORKER_DOCKER_IMAGE,
    "WORKER_DOCKER_IMAGE env variable is empty or not found"
  );

  const docker = new Docker();

  return useTempPath({ localTmpDir: true }, async (ipcDir) => {
    const request = { func: func.name, args };
    writeFileSync(path.join(ipcDir, "request"), JSON.stringify(request));

    const workerIpcDir = "/ipc";
    const container = await docker.createContainer({
      Image: WORKER_DOCKER_IMAGE,
      HostConfig: {
        Binds: [`${ipcDir}:${workerIpcDir}`, `${outputDir}:/app/output`],
      },
      Env: [`WORKER_IPCDIR=${workerIpcDir}`],
    });

    await container.start();

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });
    stream.pipe(process.stdout);

    await container.wait();
    await container.remove({ force: true });

    const reply = JSON.parse(
      readFileSync(path.join(ipcDir, "reply")).toString()
    ) as Completion<any>;

    if (isSuccess(reply)) {
      return reply.value;
    } else {
      const { error } = reply;
      throw new WorkerError(error!.type, error!.message);
    }
  });
}
