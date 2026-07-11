import { describe, expect, it } from "vitest";
import {
  getFlyOutDistance,
  getSwipeDirection,
  SWIPE_THRESHOLD,
} from "./swipe.js";

describe("swipe utilities", () => {
  it("keeps the documented swipe threshold", () => {
    expect(SWIPE_THRESHOLD).toBe(100);
  });

  it.each([
    [100, "right"],
    [101, "right"],
    [-100, "left"],
    [-101, "left"],
    [99.999, null],
    [-99.999, null],
    [0, null],
  ])("maps horizontal offset %s to %s", (offset, expected) => {
    expect(getSwipeDirection(offset)).toBe(expected);
  });

  it.each([undefined, null, "100", Number.NaN, Number.POSITIVE_INFINITY])(
    "ignores invalid horizontal offset %s",
    (offset) => {
      expect(getSwipeDirection(offset)).toBeNull();
    },
  );

  it("calculates enough distance to clear a desktop viewport", () => {
    expect(getFlyOutDistance(1366, 430)).toBe(1161);
    expect(getFlyOutDistance(1440, 430)).toBe(1198);
  });

  it("uses the minimum distance for compact viewports", () => {
    expect(getFlyOutDistance(320, 300)).toBe(540);
    expect(getFlyOutDistance(0, 430)).toBe(540);
  });

  it("uses resilient defaults for invalid dimensions", () => {
    expect(getFlyOutDistance(Number.NaN, Number.NaN)).toBe(540);
    expect(getFlyOutDistance(1400, Number.NaN)).toBe(1178);
    expect(getFlyOutDistance(1400, -1)).toBe(1178);
    expect(getFlyOutDistance(-1, 900)).toBe(948);
  });
});
