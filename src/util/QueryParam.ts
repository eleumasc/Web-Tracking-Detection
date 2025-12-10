export interface QueryParam {
  key: Part;
  value?: Part;
}

export interface Part {
  raw: string;
  index: number;
}

export function parseQueryParams(input: string): QueryParam[] {
  input = input.replace(/^\?/, "");

  const params: QueryParam[] = [];

  const re = /([^=&]+)(?:=([^&]*))?/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(input)) !== null) {
    const keyRaw = match[1];
    const valueRaw = match[2] ?? null;

    const keyStart = match.index;
    const keyEnd = keyStart + keyRaw.length;

    void decodeURIComponent(keyRaw);

    let valuePart: Part | undefined;
    if (valueRaw !== null) {
      const valueStart = keyEnd + 1;

      void decodeURIComponent(valueRaw);

      valuePart = {
        raw: valueRaw,
        index: valueStart,
      };
    }

    params.push({
      key: {
        raw: keyRaw,
        index: keyStart,
      },
      value: valuePart,
    });
  }

  return params;
}
