export class WorkerError extends Error {
  constructor(readonly type?: string, message?: string) {
    super(message);
    this.name = WorkerError.name;
  }
}
