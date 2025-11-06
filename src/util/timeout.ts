export function timeout(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

export function forever(): Promise<void> {
  return new Promise(() => {});
}

export function bomb<T>(
  timeoutMs: number,
  asyncCallback: () => Promise<T>
): Promise<T> {
  return Promise.race([
    asyncCallback(),
    timeout(timeoutMs).then(() => {
      throw new TimeoutError(`Timeout of ${timeoutMs} ms exceeded`);
    }),
  ]);
}

export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = TimeoutError.name;
  }
}
