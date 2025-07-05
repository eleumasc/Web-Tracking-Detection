export function timeout(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export function forever(): Promise<void> {
  return new Promise(() => {});
}

export function bomb<T>(
  asyncCallback: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    asyncCallback(),
    timeout(timeoutMs).then(() => {
      throw new TimeoutError(`Bomb exploded after ${timeoutMs} ms`);
    }),
  ]);
}

export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = TimeoutError.name;
  }
}
