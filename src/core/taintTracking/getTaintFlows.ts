import _ from "lodash";
import { FoxReport } from "../../foxhound/types";
import { Har } from "../../util/Har";
import { StorageItem } from "../StorageItem";
import { TaintFlow } from "../Flow";

export function getTaintFlows(
  foxhoundReports: FoxReport[],
  storageItems: StorageItem[],
  har: Har,
): TaintFlow[] {
  throw new Error("Not implemented");
}
