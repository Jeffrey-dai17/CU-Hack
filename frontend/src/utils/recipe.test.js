import { describe, expect, it } from "vitest";
import {
  formatCalories,
  formatMacro,
  formatServings,
  formatTime,
  getSafeHttpUrl,
  isUsableRecipe,
  normalizeImageUrl,
  normalizeRecipeId,
} from "./recipe.js";

describe("recipe formatting", () => {
  it.each([
    [0, "0 kcal"],
    [479.5, "480 kcal"],
    [479.49, "479 kcal"],
  ])("formats calorie value %s", (value, expected) => {
    expect(formatCalories(value)).toBe(expected);
  });

  it.each([undefined, null, "480", -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "uses the calorie fallback for invalid value %s",
    (value) => {
      expect(formatCalories(value)).toBe("Calories N/A");
    },
  );

  it.each([
    [0, "0g"],
    [37.6, "38g"],
    [37.49, "37g"],
  ])("formats macro value %s", (value, expected) => {
    expect(formatMacro(value)).toBe(expected);
  });

  it.each([undefined, null, "38", -0.1, Number.NaN, Number.NEGATIVE_INFINITY])(
    "uses the macro fallback for invalid value %s",
    (value) => {
      expect(formatMacro(value)).toBe("N/A");
    },
  );

  it.each([
    [0, "0 min"],
    [24.6, "25 min"],
  ])("formats time value %s", (value, expected) => {
    expect(formatTime(value)).toBe(expected);
  });

  it.each([undefined, null, "25", -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "uses the time fallback for invalid value %s",
    (value) => {
      expect(formatTime(value)).toBe("Time N/A");
    },
  );

  it.each([
      [0, ""],
    [0.6, "1 serving"],
    [1, "1 serving"],
    [1.49, "1 serving"],
    [1.5, "2 servings"],
    [3, "3 servings"],
  ])("pluralizes rounded serving value %s", (value, expected) => {
    expect(formatServings(value)).toBe(expected);
  });

  it.each([undefined, null, "1", -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "omits invalid serving value %s",
    (value) => {
      expect(formatServings(value)).toBe("");
    },
  );

  it("trims valid image URLs", () => {
    expect(normalizeImageUrl("  https://images.example/meal.jpg\n")).toBe(
      "https://images.example/meal.jpg",
    );
    expect(normalizeImageUrl("   ")).toBe("");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "//images.example/relative.jpg",
    "/relative.jpg",
    "https://user:password@images.example/private.jpg",
  ])("rejects an unsafe image URL: %s", (value) => {
    expect(normalizeImageUrl(value)).toBe("");
    expect(getSafeHttpUrl(value)).toBe("");
  });

  it.each([undefined, null, 42, {}, []])(
    "rejects non-string image URL value %s",
    (value) => {
      expect(normalizeImageUrl(value)).toBe("");
    },
  );

  it.each([
    ["1", "1"],
    ["9007199254740991", "9007199254740991"],
    [" 12345 ", "12345"],
    ["0", ""],
    ["01", ""],
    ["-1", ""],
    ["alpha/42", ""],
    ["9007199254740992", ""],
    [12345, ""],
  ])("normalizes canonical recipe id %j", (value, expected) => {
    expect(normalizeRecipeId(value)).toBe(expected);
  });

  it("accepts only object recipes with canonical string ids", () => {
    expect(isUsableRecipe({ id: "12345" })).toBe(true);
    expect(isUsableRecipe({ id: 12345 })).toBe(false);
    expect(isUsableRecipe({ id: "alpha" })).toBe(false);
    expect(isUsableRecipe([])).toBe(false);
    expect(isUsableRecipe(null)).toBe(false);
  });
});
