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
  let offset = input.startsWith("?") ? 1 : 0;
  input = offset !== 0 ? input.substring(offset) : input;

  const result: QueryParam[] = [];

  for (const match of input.matchAll(/([^=&]+)(?:=([^&]*))?/g)) {
    const { 1: nameRaw, 2: valueRaw, index: matchIndex } = match;

    const nameBegin = matchIndex + offset;
    const nameEnd = nameBegin + nameRaw.length;

    let valuePart: Part | undefined;
    if (valueRaw !== undefined) {
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
