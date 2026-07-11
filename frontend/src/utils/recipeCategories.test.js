import { describe, expect, it } from "vitest";
import {
  RECIPE_CATEGORIES,
  normalizeRecipeCategoryId,
} from "./recipeCategories.js";

describe("recipe category utilities", () => {
  it("normalizes supported category ids and falls back to all matches", () => {
    expect(RECIPE_CATEGORIES.map((category) => category.id)).toContain("high-protein");
    expect(normalizeRecipeCategoryId("  HIGH-PROTEIN  ")).toBe("high-protein");
    expect(normalizeRecipeCategoryId("dessert")).toBe("");
    expect(normalizeRecipeCategoryId(null)).toBe("");
  });
});
