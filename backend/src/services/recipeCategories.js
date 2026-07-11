const CATEGORY_FILTERS = Object.freeze({
  "low-calorie": Object.freeze({ maxCalories: 500 }),
  "high-protein": Object.freeze({ minProtein_g: 30 }),
  "under-30-mins": Object.freeze({ maxReadyTime: 30 }),
  vegetarian: Object.freeze({ diet: "vegetarian" }),
  vegan: Object.freeze({ diet: "vegan" }),
  "gluten-free": Object.freeze({ diet: "gluten free" }),
  keto: Object.freeze({ diet: "ketogenic" }),
});

function normalizeRecipeCategory(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";

  return Object.prototype.hasOwnProperty.call(CATEGORY_FILTERS, normalized)
    ? normalized
    : null;
}

function mergeRecipeCategoryFilter(parsedFilter, categoryId) {
  const categoryFilter = CATEGORY_FILTERS[categoryId] || {};
  const merged = { ...parsedFilter };

  if (categoryFilter.maxCalories !== undefined) {
    merged.maxCalories =
      merged.maxCalories === undefined
        ? categoryFilter.maxCalories
        : Math.min(merged.maxCalories, categoryFilter.maxCalories);
  }

  if (categoryFilter.minProtein_g !== undefined) {
    merged.minProtein_g =
      merged.minProtein_g === undefined
        ? categoryFilter.minProtein_g
        : Math.max(merged.minProtein_g, categoryFilter.minProtein_g);
  }

  if (categoryFilter.maxReadyTime !== undefined) {
    merged.maxReadyTime =
      merged.maxReadyTime === undefined
        ? categoryFilter.maxReadyTime
        : Math.min(merged.maxReadyTime, categoryFilter.maxReadyTime);
  }

  if (categoryFilter.diet !== undefined) {
    merged.diet = categoryFilter.diet;
  }

  return merged;
}

module.exports = {
  CATEGORY_FILTERS,
  mergeRecipeCategoryFilter,
  normalizeRecipeCategory,
};
