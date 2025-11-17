import { assert } from "console";

export default class BufferedCallback<T> {
  protected buffer: T[] = [];

  constructor(
    readonly bufferSize: number,
    readonly callback: (values: T[]) => void
  ) {
    assert(bufferSize >= 1);
  }

  add(value: T) {
    this.buffer.push(value);
    if (this.buffer.length >= this.bufferSize) {
      this.callback([...this.buffer]);
      this.buffer.length = 0;
    }
  }

  flush() {
    if (this.buffer.length !== 0) {
      this.callback([...this.buffer]);
      this.buffer.length = 0;
    }
  }
}
