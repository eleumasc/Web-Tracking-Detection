export interface QueryParam {
  name: Part;
  value?: Part;
}

export interface Part {
  raw: string;
  begin: number;
  end: number;
}

export function parseQueryParams(input: string): QueryParam[] {
  input = input.replace(/^\?/, "");

  const result: QueryParam[] = [];

  const re = /([^=&]+)(?:=([^&]*))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const nameRaw = match[1];
    const valueRaw = match[2] ?? null;

    const nameBegin = match.index;
    const nameEnd = nameBegin + nameRaw.length;

    let valuePart: Part | undefined;
    if (valueRaw !== null) {
      const valueBegin = nameEnd + 1;

      valuePart = {
        raw: valueRaw,
        begin: valueBegin,
        end: valueBegin + valueRaw.length,
      };
    }

    result.push({
      name: {
        raw: nameRaw,
        begin: nameBegin,
        end: nameBegin + nameRaw.length,
      },
      value: valuePart,
    });
  }

  return result;
}
