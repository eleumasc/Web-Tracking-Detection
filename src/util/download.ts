import { createReadStream } from "fs";
import { Readable } from "stream";

export async function download(pathOrUrl: string | URL): Promise<Readable> {
  if (URL.canParse(pathOrUrl)) {
    pathOrUrl = new URL(pathOrUrl);
    switch (pathOrUrl.protocol) {
      case "http:":
      case "https:": {
        const response = await fetch(pathOrUrl);
        if (!response.body) {
          throw new Error(
            `Cannot download (status ${response.status}): ${pathOrUrl}`
          );
        }
        // @ts-ignore
        const readableStream = Readable.fromWeb(response.body);
        return readableStream;
      }
      default:
        throw new Error(`Unknown protocol: ${pathOrUrl.protocol}`);
    }
  } else {
    return createReadStream(pathOrUrl);
  }
}
