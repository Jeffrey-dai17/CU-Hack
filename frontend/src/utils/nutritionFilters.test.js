import { describe, expect, it } from "vitest";
import {
  applyNutritionTargets,
  createNutritionGoalText,
  hasNutritionTargetInput,
  TARGET_TOLERANCE,
} from "./nutritionFilters.js";

describe("applyNutritionTargets", () => {
  it("leaves a parsed goal untouched when all optional nutrition controls are blank", () => {
    const parsedFilter = { diet: "vegan", maxReadyTime: 30 };

    expect(applyNutritionTargets(parsedFilter, { calories: "", protein: "", carbs: "" })).toEqual({
      filter: parsedFilter,
      error: "",
    });
  });

  it("converts each target into a bounded per-serving range while preserving the goal", () => {
    expect(
      applyNutritionTargets(
        { diet: "vegan", maxCalories: 600, minProtein_g: 30 },
        { calories: "500", protein: "40", carbs: "60" },
      ),
    ).toEqual({
      filter: {
        diet: "vegan",
        minCalories: 400,
        maxCalories: 600,
        minProtein_g: 32,
        maxProtein_g: 48,
        minCarbs_g: 48,
        maxCarbs_g: 72,
      },
      error: "",
    });
    expect(TARGET_TOLERANCE).toBe(0.2);
  });

  it("rejects non-integer and out-of-range controls without changing the parsed goal", () => {
    const parsedFilter = { diet: "vegan" };

    expect(applyNutritionTargets(parsedFilter, { calories: "500.5", protein: "", carbs: "" })).toEqual({
      filter: parsedFilter,
      error: "Enter whole-number nutrition targets within the shown ranges.",
    });
    expect(applyNutritionTargets(parsedFilter, { calories: "", protein: "501", carbs: "" }).error).not.toBe("");
  });

  it("recognizes category-only goals and gives them a meaningful saved label", () => {
    expect(hasNutritionTargetInput({ calories: "", protein: "40", carbs: "" })).toBe(true);
    expect(hasNutritionTargetInput({ calories: " ", protein: null, carbs: "" })).toBe(false);
    expect(createNutritionGoalText({ calories: "500", protein: "40", carbs: "60" })).toBe(
      "Recipes around 500 calories, 40g protein, 60g carbs per serving",
    );
  });
});
