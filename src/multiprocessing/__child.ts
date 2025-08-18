import { Completion, Failure, Success } from "../util/Completion";
import { MP_FUNCTIONS } from "./functions";
import { receiveMessage, sendMessage } from "./messaging";

async function main() {
  // ensure to be in a child process
  if (!process.send) process.exit(1);

  const message = await receiveMessage();

  const { func: funcName, args } = message as { func: string; args: any[] };

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

  await sendMessage(completion);

  process.exit(0);
}

main();
