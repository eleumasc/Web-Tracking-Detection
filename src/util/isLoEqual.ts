import _ from "lodash";

export default function isLoEqual(value: any, other: any): boolean {
  return _.isEqualWith(value, other, (_value, _other, indexOrKey) => {
    if (typeof indexOrKey === "string" && indexOrKey.startsWith("_")) {
      return true;
    }
  });
}
