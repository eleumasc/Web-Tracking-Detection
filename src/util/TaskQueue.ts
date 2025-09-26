import _ from "lodash";
import { queue, QueueObject } from "async";

export type Task = () => Promise<void>;

export type TaskQueue = QueueObject<Task>;

export async function useTaskQueue<T>(
  options:
    | {
        maxTasks?: number;
        abortSignal?: AbortSignal;
      }
    | undefined,
  use: (taskQueue: TaskQueue) => Promise<T>
): Promise<T> {
  options = _.defaults(
    { ...options },
    {
      maxTasks: 1,
    }
  );
  const taskQueue = queue<Task, unknown>(async (task, callback) => {
    try {
      await task();
      callback();
    } catch (error) {
      callback(error);
    }
  }, options.maxTasks);
  const { abortSignal } = options;
  if (abortSignal) {
    abortSignal.addEventListener("abort", () => {
      taskQueue.remove(() => true);
      console.error("Aborted, waiting for running tasks to terminate...");
    });
  }
  try {
    return await use(taskQueue);
  } finally {
    taskQueue.kill();
  }
}
export function processTaskQueue<T>(
  inputs: T[],
  taskQueueOptions: Parameters<typeof useTaskQueue>[0],
  taskFactory: (input: T, queueIndex: number) => Task
): Promise<void> {
  return useTaskQueue(taskQueueOptions, async (taskQueue) => {
    taskQueue.push(inputs.map(taskFactory));
    await taskQueue.drain();
  });
}
