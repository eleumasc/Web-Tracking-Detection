import _ from "lodash";
import assert from "assert";
import Docker from "dockerode";
import path from "path";
import useTempPath from "../util/useTempPath";
import { Completion, isSuccess } from "../util/Completion";
import { CONTAINER_IMAGE } from "../env";
import { GuestError } from "./GuestError";
import { outputDir } from "../data/outputDir";
import { readFileSync, writeFileSync } from "fs";
import { Task } from "./Task";

export default async function execContainer<R>(
  task: Task,
  options?: {
    extraBinds?: string[];
  }
): Promise<Awaited<R>> {
  assert(CONTAINER_IMAGE, "CONTAINER_IMAGE env variable is empty or not found");

  const docker = new Docker();

  return useTempPath({ localTmpDir: true }, async (ipcDir) => {
    writeFileSync(path.join(ipcDir, "request"), JSON.stringify(task));

    const guestIpcDir = "/ipc";
    const container = await docker.createContainer({
      Image: CONTAINER_IMAGE,
      HostConfig: {
        Binds: [
          `${ipcDir}:${guestIpcDir}`,
          `${outputDir}:/app/output`,
          ...(options?.extraBinds ?? []),
        ],
        AutoRemove: true,
      },
      Env: [`IPCDIR=${guestIpcDir}`],
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
