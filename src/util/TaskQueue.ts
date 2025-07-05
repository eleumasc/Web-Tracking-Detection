import { queue, QueueObject } from "async";

export type Task = () => Promise<void>;

export type TaskQueue = QueueObject<Task>;

export async function useTaskQueue<T>(
  options:
    | {
        maxTasks?: number;
      }
    | undefined,
  use: (taskQueue: TaskQueue) => Promise<T>
): Promise<T> {
  const taskQueue = queue<Task, unknown>(async (task, callback) => {
    try {
      await task();
      callback();
    } catch (error) {
      callback(error);
    }
  }, options?.maxTasks ?? 1);
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
