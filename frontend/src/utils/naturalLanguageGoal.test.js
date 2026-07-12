import { describe, expect, it } from "vitest";
import {
  applyMealType,
  createMealTypeGoalText,
  createNaturalLanguageGoalText,
  hasNaturalLanguageFilterInput,
  MAX_AUXILIARY_FILTER_LENGTH,
  MAX_PARSED_GOAL_LENGTH,
} from "./naturalLanguageGoal.js";

describe("natural-language goal helpers", () => {
  it("detects free-form culture and allergy details", () => {
    expect(hasNaturalLanguageFilterInput()).toBe(false);
    expect(hasNaturalLanguageFilterInput({ cultureText: "Chinese or Italian" })).toBe(true);
    expect(hasNaturalLanguageFilterInput({ allergyText: "strawberries" })).toBe(true);
  });

  it("keeps labelled culture alternatives and non-standard allergies together for LLM interpretation", () => {
    expect(
      createNaturalLanguageGoalText({
        goalText: "I want pasta",
        cultureText: " Chinese or   Italian ",
        allergyText: " strawberry and alpha-gal ",
      }),
    ).toEqual({
      error: "",
      text:
        "I want pasta\nCuisine or culture preference: Chinese or Italian.\nAllergies or ingredients to avoid: strawberry and alpha-gal.",
    });
  });

  it("keeps a plain craving unchanged and rejects only an oversized combined request", () => {
    expect(createNaturalLanguageGoalText({ goalText: "ramen" })).toEqual({
      error: "",
      text: "ramen",
    });
    expect(
      createNaturalLanguageGoalText({
        goalText: "x".repeat(MAX_PARSED_GOAL_LENGTH),
        cultureText: "y".repeat(MAX_AUXILIARY_FILTER_LENGTH),
      }),
    ).toMatchObject({ error: expect.stringContaining("1000") });
  });

  it("lets the explicit meal category override inferred meal type without affecting other filters", () => {
    expect(applyMealType({ cuisines: ["japanese"], mealType: "breakfast" }, "dessert")).toEqual({
      cuisines: ["japanese"],
      mealType: "dessert",
    });
    expect(createMealTypeGoalText("main course")).toBe("Recipes: Lunch & dinner");
    expect(createMealTypeGoalText("")).toBe("");
  });
});
