import assert from "assert";
import { Range } from "../util/Range";

type ParsedURL = {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  inputIdx: number;
};

export class FoxURL {
  readonly protocol: string;
  readonly hostname: string;
  readonly port: string;
  readonly host: string;
  readonly origin: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly href: string;

  readonly taintableRange: Range;
  readonly inputRange: Range;

  constructor(input: string, baseUrl?: string) {
    input = input.trim();
    baseUrl = baseUrl?.trim();

    const parsed = baseUrl
      ? FoxURL.combineWithBase(input, baseUrl)
      : FoxURL.parseAbsolute(input);

    this.protocol = parsed.protocol;
    this.hostname = parsed.hostname;
    this.port = parsed.port;
    this.host = FoxURL.computeHost(this.hostname, this.port);
    this.origin = this.host ? this.protocol + "//" + this.host : "null";
    this.pathname = parsed.pathname;
    this.search = parsed.search;
    this.hash = "";
    this.href =
      this.protocol +
      (this.host ? "//" + this.host : "") +
      this.pathname +
      this.search +
      this.hash;

    const { pathnameIdx, hashIdx } = FoxURL.computeIndexes(parsed);

    this.taintableRange = { begin: pathnameIdx, end: hashIdx };

    this.inputRange = {
      begin: parsed.inputIdx,
      end: parsed.inputIdx + input.length,
    };
  }

  protected static parseAbsolute(
    input: string,
    inputIdx: number = 0,
  ): ParsedURL {
    const re =
      /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/([^\/?#@]*))?([^?#]*)(\?[^#]*)?(#.*)?$/;

    const m = input.match(re);
    if (!m) {
      throw new SyntaxError("Invalid URL");
    }

    const scheme = m[1];
    const hostport = m[2];
    const pathname = m[3] || "/";
    const search = m[4] || "";
    const hash = m[5] || "";

    if (!scheme) {
      throw new SyntaxError("Missing scheme");
    }

    const protocol = scheme + ":";

    if (hostport && hostport.includes("@")) {
      throw new Error("Userinfo not permitted in URL");
    }

    let hostname: string = "";
    let port: string = "";

    if (hostport) {
      const portIdx = hostport.lastIndexOf(":");

      if (hostport.startsWith("[") && hostport.includes("]")) {
        const end = hostport.indexOf("]");
        hostname = hostport.slice(0, end + 1);

        if (hostport.length > end + 1 && hostport[end + 1] === ":") {
          port = hostport.slice(end + 2);
        }
      } else if (portIdx > 0 && hostport.indexOf(":") === portIdx) {
        hostname = hostport.slice(0, portIdx);
        port = hostport.slice(portIdx + 1);
      } else {
        hostname = hostport;
      }
    }

    return {
      protocol,
      hostname,
      port,
      pathname,
      search,
      hash,
      inputIdx,
    };
  }

  protected static combineWithBase(input: string, baseUrl: string): ParsedURL {
    const base = FoxURL.parseAbsolute(baseUrl);

    // Parse relative/absolute input inline
    const re =
      /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/([^\/?#@]*))?([^?#]*)(\?[^#]*)?(#.*)?$/;

    const m = input.match(re);
    if (!m) {
      throw new Error("Invalid URL");
    }

    const scheme = m[1];
    const hostport = m[2];
    const relativePathname = m[3] || "";
    const relativeSearch = m[4] || "";
    const relativeHash = m[5] || "";

    // Absolute scheme replaces everything
    if (scheme) {
      return FoxURL.parseAbsolute(input);
    }

    // Authority replacement: //host
    if (hostport) {
      const { protocol } = base;
      return FoxURL.parseAbsolute(
        protocol +
          "//" +
          hostport +
          relativePathname +
          relativeSearch +
          relativeHash,
        protocol.length,
      );
    }

    let pathname: string;
    let search: string;
    let hash: string;

    const { pathnameIdx, searchIdx, hashIdx } = FoxURL.computeIndexes(base);
    let inputIdx: number = -1;

    // Pathname resolution
    if (relativePathname.startsWith("/")) {
      // e.g., replace "/foo/bar" in "https://example.com/foo/bar"
      pathname = relativePathname;
      inputIdx = pathnameIdx;
    } else if (relativePathname.length === 0) {
      pathname = base.pathname;
    } else {
      // Merge paths
      const basePathname = base.pathname;
      const idx = basePathname.lastIndexOf("/");
      if (idx === -1) {
        // e.g., replace "blank" in "about:blank"
        pathname = relativePathname;
        inputIdx = pathnameIdx;
      } else {
        // e.g., replace "bar" in "https://example.com/foo/bar"
        pathname = basePathname.slice(0, idx + 1) + relativePathname;
        inputIdx = pathnameIdx + idx + 1;
      }
    }

    // Search resolution
    if (relativeSearch) {
      search = relativeSearch;
      if (relativePathname.length === 0) {
        inputIdx = searchIdx;
      }
    } else if (relativePathname) {
      search = "";
    } else {
      search = base.search;
    }

    // Hash resolution
    hash = relativeHash || "";
    if (relativePathname.length === 0 && relativeSearch.length === 0) {
      inputIdx = hashIdx;
    }

    assert(inputIdx !== -1);

    return {
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port,
      pathname,
      search,
      hash,
      inputIdx,
    };
  }

  protected static computeIndexes(parsed: ParsedURL) {
    const { protocol, hostname, port, pathname, search } = parsed;
    const host = FoxURL.computeHost(hostname, port);
    const pathnameIdx = (protocol + (host ? "//" + host : "")).length;
    const searchIdx = pathnameIdx + pathname.length;
    const hashIdx = searchIdx + search.length;
    return { pathnameIdx, searchIdx, hashIdx };
  }

  protected static computeHost(hostname: string, port: string): string {
    return port ? `${hostname}:${port}` : hostname;
  }

  toString(): string {
    return this.href;
  }
}
