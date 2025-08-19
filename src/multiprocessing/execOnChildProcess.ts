import { fork } from "child_process";
import path from "path";
import { Completion, isSuccess } from "../util/Completion";
import { MultiProcessingError, ChildProcessError } from "./errors";

export default function execOnChildProcess<A extends any[], R>(
  func: (...args: A) => R,
  [...args]: A
): Promise<Awaited<R>> {
  return new Promise(async (res, rej) => {
    let completion: Completion<Awaited<R>> | undefined;
    let didExitOrError = false;

    const childProcess = fork(path.join(__dirname, "__child"));

    // graceful termination
    const onExitHandler = () => {
      childProcess.kill();
    };
    process.addListener("exit", onExitHandler);

    childProcess.on("error", (e) => {
      if (didExitOrError) return;
      didExitOrError = true;

      process.removeListener("exit", onExitHandler);

      rej(new MultiProcessingError(e.message));
    });

    childProcess.on("exit", (code, signal) => {
      if (didExitOrError) return;
      didExitOrError = true;

      process.removeListener("exit", onExitHandler);

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

    childProcess.once("message", (replyMessage: any) => {
      completion = replyMessage;
    });

    childProcess.send!({ func: func.name, args });
  });
}
