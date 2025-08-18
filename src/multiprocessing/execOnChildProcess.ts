import { fork } from "child_process";
import path from "path";
import { Completion, isSuccess } from "../util/Completion";
import { receiveMessage, sendMessage } from "./messaging";

export default function execOnChildProcess<A extends any[], R>(
  func: (...args: A) => R,
  [...args]: A
): Promise<Awaited<R>> {
  return new Promise(async (res, rej) => {
    let completion: Completion<Awaited<R>> | undefined;

    const child = fork(path.join(__dirname, "__child"));

    child.on("error", (e) => {
      rej(new MultiProcessingError(e.message));
    });

    child.on("exit", (code, signal) => {
      if (!completion) {
        rej(
          new MultiProcessingError(
            `Premature exit with code ${code}, signal ${signal}`
          )
        );
        return;
      }
      if (isSuccess(completion)) {
        res(completion.value);
      } else {
        const { error } = completion;
        rej(new ChildProcessError(error?.type, error?.message));
      }
    });

    try {
      await sendMessage({ func: func.name, args }, child);
      completion = await receiveMessage(child);
    } catch {
      // suppress, let child.on("error") handle errors
    }
  });
}

export class ChildProcessError extends Error {
  constructor(readonly type?: string, message?: string) {
    super(message);
    this.name = ChildProcessError.name;
  }
}

export class MultiProcessingError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = MultiProcessingError.name;
  }
}
