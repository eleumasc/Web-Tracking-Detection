import _ from "lodash";
import assert from "assert";
import { Range } from "./Range";

export default class Interval {
  protected ranges: Range[] = [];

  getRanges(): Range[] {
    return this.ranges.map(({ begin, end }) => ({ begin, end }));
  }

  addRange(begin: number, end: number): this {
    if (begin >= end) {
      return this;
    }

    const { ranges } = this;
    const N = ranges.length;

    let glb = -1;
    for (let a = 0, b = N; a < b; ) {
      const m = (a + b) >> 1;
      if (
        ranges[m].begin <= begin &&
        (m + 1 === N || begin < ranges[m + 1].begin)
      ) {
        glb = m;
        break;
      } else if (ranges[m].begin < begin) {
        a = m;
      } else {
        b = m;
      }
    }

    let lub = -1;
    for (let a = Math.max(glb, 0), b = N; a < b; ) {
      const m = (a + b) >> 1;
      if (
        ranges[m].begin <= end &&
        (m + 1 === N || end < ranges[m + 1].begin)
      ) {
        lub = m;
        break;
      } else if (ranges[m].begin < end) {
        a = m;
      } else {
        b = m;
      }
    }

    const newBegin =
      glb !== -1
        ? ranges[glb].end < begin
          ? begin
          : ranges[glb].begin
        : begin;
    const newEnd = lub !== -1 ? Math.max(ranges[lub].end, end) : end;

    this.ranges = [
      ...(glb !== -1 ? ranges.slice(0, glb) : []),
      ...(glb !== -1 && ranges[glb].end < begin ? [ranges[glb]] : []),
      { begin: newBegin, end: newEnd },
      ...ranges.slice(lub + 1),
    ];

    return this;
  }
}
