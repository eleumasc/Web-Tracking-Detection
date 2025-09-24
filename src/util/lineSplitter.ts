import { Transform } from "stream";

export default function lineSplitter() {
  let buffer: string = "";

  return new Transform({
    readableObjectMode: true,
    transform(chunk, _, callback) {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        this.push(line);
      }
      callback();
    },
    flush(callback) {
      if (buffer) this.push(buffer);
      callback();
    },
  });
}
