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
