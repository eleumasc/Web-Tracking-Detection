import { Completion, Failure, Success } from "../util/Completion";
import { bomb } from "../util/timeout";
import { MP_FUNCTIONS } from "./functions";

const RECEIVE_TIMEOUT_MS: number = 30 * 1000; // 30 seconds

async function runChild() {
  const requestMessage = await bomb(
    () =>
      new Promise<any>((res) => {
        process.once("message", (message: any) => {
          res(message);
        });
      }),
    RECEIVE_TIMEOUT_MS
  );

  const { func: funcName, args } = requestMessage as {
    func: string;
    args: any[];
  };

  let completion: Completion<any>;
  try {
    const func = MP_FUNCTIONS[funcName];
    if (!func) {
      throw new ReferenceError(
        `${funcName} is not defined in multiprocessing/functions`
      );
    }

    const result = await Reflect.apply(func, undefined, args);
    completion = Success(result);
  } catch (e) {
    completion = Failure.from(e);
  }

  await new Promise<void>((res, rej) => {
    process.send!(completion, undefined, undefined, (e) => {
      if (e) rej(e);
      else res();
    });
  });
}

async function main() {
  // ensure to be in a child process
  if (!process.send) process.exit(1);

  try {
    await runChild();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
