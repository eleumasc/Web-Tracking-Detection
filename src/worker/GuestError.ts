export class GuestError extends Error {
  constructor(readonly type?: string, message?: string) {
    super(message);
    this.name = GuestError.name;
  }
}
