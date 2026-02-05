import { FoxRange } from "../../foxhound/types";

export interface StorageCharFlow {
  storageType: string;
  key: string;
  value: string;
  storageIndex: number;
  begin: number;
  end: number;
  intermeds: string[];
}

export function tryParseStorageCharFlow(
  foxRange: FoxRange,
): StorageCharFlow | undefined {
  try {
    return parseStorageCharFlow(foxRange);
  } catch {
    return;
  }
}

export function parseStorageCharFlow(foxRange: FoxRange): StorageCharFlow {
  const { begin, end, flow } = foxRange;
  const sourceOperation = flow.at(-1)!;
  const { arguments: args } = sourceOperation;
  const intermeds = flow
    .slice(1, -1)
    .map(({ arguments: args }) => args[0])
    .filter((x) => typeof x === "string");
  switch (sourceOperation.operation) {
    case "document.cookie":
      if (sourceOperation.source) {
        return {
          storageType: "cookie",
          key: args[0],
          value: args[1],
          storageIndex: Number(args[2]),
          begin,
          end,
          intermeds,
        };
      } else {
        break;
      }
    case "localStorage.getItem":
      return {
        storageType: "localStorage",
        key: args[0],
        value: args[1],
        storageIndex: Number(args[2]),
        begin,
        end,
        intermeds,
      };
  }
  throw new Error(
    `Cannot parse storage char flow: ${sourceOperation.operation}`,
  );
}
