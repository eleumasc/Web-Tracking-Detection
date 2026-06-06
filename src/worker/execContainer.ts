import _ from "lodash";
import assert from "assert";
import Docker from "dockerode";
import path from "path";
import useTempPath from "../data/temp";
import { Completion, isSuccess } from "../util/Completion";
import { dataHostDir } from "../data/path";
import { DOCKER_IMAGE, DOCKER_NET } from "../env";
import { GuestError } from "./GuestError";
import { readFileSync, writeFileSync } from "fs";
import { Task } from "./Task";

export default async function execContainer<R>(
  task: Task,
  options?: {
    extraBinds?: string[];
  }
): Promise<Awaited<R>> {
  assert(DOCKER_IMAGE, "DOCKER_IMAGE env variable is empty or not found");
  assert(DOCKER_NET, "DOCKER_NET env variable is empty or not found");

  const docker = new Docker();

  return useTempPath(async (ipcDir, ipcHostDir) => {
    writeFileSync(path.join(ipcDir, "request"), JSON.stringify(task));

    const ipcWorkerDir = "/ipc";
    const container = await docker.createContainer({
      Image: DOCKER_IMAGE,
      Entrypoint: ["node", "build/worker/__containerEntry.js"],
      HostConfig: {
        NetworkMode: DOCKER_NET,
        Binds: [
          `${ipcHostDir}:${ipcWorkerDir}`,
          `${dataHostDir}:/root/data`,
          ...(options?.extraBinds ?? []),
        ],
        AutoRemove: true,
      },
      Env: [`IPCDIR=${ipcWorkerDir}`],
    });

    await container.start();

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });
    stream.pipe(process.stdout);

    await container.wait();

    const completion = JSON.parse(
      readFileSync(path.join(ipcDir, "reply")).toString()
    ) as Completion<any>;

    if (isSuccess(completion)) {
      return completion.value;
    } else {
      const { error } = completion;
      throw new GuestError(error!.type, error!.message);
    }
  });
}
