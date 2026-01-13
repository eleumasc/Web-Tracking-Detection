export interface QueryParam {
  name: Part;
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
    const nameRaw = match[1];
    const valueRaw = match[2] ?? null;

    const nameStart = match.index;
    const nameEnd = nameStart + nameRaw.length;

    let valuePart: Part | undefined;
    if (valueRaw !== null) {
      const valueStart = nameEnd + 1;

      valuePart = {
        raw: valueRaw,
        index: valueStart,
      };
    }

    params.push({
      name: {
        raw: nameRaw,
        index: nameStart,
      },
      value: valuePart,
    });
  }

  return params;
}
