import { describe, expect, it } from "vitest";
import { pageBounds, pageSizes } from "./pagination";

describe("pagination", () => {
  it("supports the requested sizes and slices the last page", () => {
    expect(pageSizes).toEqual([10, 20, 50]);
    expect(pageBounds(53, 20, 3)).toEqual({page: 3, pages: 3, start: 40, end: 53});
    expect(pageBounds(53, 50, 1)).toEqual({page: 1, pages: 2, start: 0, end: 50});
  });
  it("clamps missing pages after a dataset shrinks and handles empty results", () => {
    expect(pageBounds(1, 20, 50)).toEqual({page: 1, pages: 1, start: 0, end: 1});
    expect(pageBounds(0, 20, 5)).toEqual({page: 1, pages: 1, start: 0, end: 0});
  });
});
