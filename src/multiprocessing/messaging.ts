import { ChildProcess } from "child_process";

export function receiveMessage(childProcess?: ChildProcess): Promise<any> {
  return new Promise<any>((res) => {
    const p = childProcess ?? process;
    p.once("message", (msg: any) => {
      res(msg);
    });
  });
}

export function sendMessage(
  message: any,
  childProcess?: ChildProcess
): Promise<void> {
  return new Promise<void>((res, rej) => {
    const p = childProcess ?? process;
    p.send!(message, undefined, undefined, (e) => {
      if (e) rej(e);
      else res();
    });
  });
}
