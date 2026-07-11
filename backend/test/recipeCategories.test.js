const assert = require("node:assert/strict");
const test = require("node:test");

const {
  mergeRecipeCategoryFilter,
  normalizeRecipeCategory,
} = require("../src/services/recipeCategories");

test("normalizeRecipeCategory accepts supported dropdown ids only", () => {
  assert.equal(normalizeRecipeCategory(undefined), "");
  assert.equal(normalizeRecipeCategory("  HIGH-PROTEIN  "), "high-protein");
  assert.equal(normalizeRecipeCategory(""), "");
  assert.equal(normalizeRecipeCategory("dessert"), null);
  assert.equal(normalizeRecipeCategory(["high-protein"]), null);
});

test("mergeRecipeCategoryFilter applies stricter category refinements", () => {
  assert.deepEqual(
    mergeRecipeCategoryFilter(
      { maxCalories: 700, minProtein_g: 40, maxReadyTime: 45 },
      "low-calorie"
    ),
    { maxCalories: 500, minProtein_g: 40, maxReadyTime: 45 }
  );
  assert.deepEqual(
    mergeRecipeCategoryFilter({ minProtein_g: 20 }, "high-protein"),
    { minProtein_g: 30 }
  );
  assert.deepEqual(
    mergeRecipeCategoryFilter({ maxReadyTime: 20 }, "under-30-mins"),
    { maxReadyTime: 20 }
  );
  assert.deepEqual(
    mergeRecipeCategoryFilter({ diet: "vegetarian" }, "gluten-free"),
    { diet: "gluten free" }
  );
});
