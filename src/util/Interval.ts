import _ from "lodash";
import assert from "assert";
import { Range } from "./Range";

export default class Interval {
  protected ranges: Range[] = [];

  getRanges(): Range[] {
    return this.ranges.map(({ begin, end }) => ({ begin, end }));
  }

  includes(x: number): boolean {
    const glb = this.glbRangeIndex(x);
    return glb !== -1 && x < this.ranges[glb].end;
  }

  addRange(begin: number, end: number): this {
    if (begin >= end) {
      return this;
    }

    const { ranges } = this;

    const glb = this.glbRangeIndex(begin);
    const lub = this.lubRangeIndex(end, Math.max(glb, 0));

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

  protected glbRangeIndex(x: number): number {
    const { ranges } = this;
    const N = ranges.length;
    let glb = -1;
    for (let a = 0, b = N; a < b; ) {
      const m = (a + b) >> 1;
      if (ranges[m].begin <= x && (m + 1 === N || x < ranges[m + 1].begin)) {
        glb = m;
        break;
      } else if (ranges[m].begin < x) {
        a = m;
      } else {
        b = m;
      }
    }
    return glb;
  }

  protected lubRangeIndex(x: number, from: number = 0): number {
    const { ranges } = this;
    const N = ranges.length;
    let lub = -1;
    for (let a = from, b = N; a < b; ) {
      const m = (a + b) >> 1;
      if (ranges[m].begin <= x && (m + 1 === N || x < ranges[m + 1].begin)) {
        lub = m;
        break;
      } else if (ranges[m].begin < x) {
        a = m;
      } else {
        b = m;
      }
    }
    return lub;
  }

  static fromRanges(ranges: Range[]): Interval {
    const N = ranges.length;
    for (let i = 0; i < N; ++i) {
      const { begin, end } = ranges[i];
      assert(begin < end);
      if (i !== 0) {
        assert(ranges[i - 1].end <= begin);
      }
    }
    const interval = new Interval();
    interval.ranges = ranges;
    return interval;
  }
}
