export const RECIPE_CATEGORIES = Object.freeze([
  { id: "", label: "All matches" },
  { id: "low-calorie", label: "Low calorie" },
  { id: "high-protein", label: "High protein" },
  { id: "under-30-mins", label: "Under 30 min" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten-free", label: "Gluten-free" },
  { id: "keto", label: "Keto" },
]);

const CATEGORY_IDS = new Set(RECIPE_CATEGORIES.map((category) => category.id));

export function normalizeRecipeCategoryId(value) {
  if (typeof value !== "string") return "";
  const categoryId = value.trim().toLowerCase();
  return CATEGORY_IDS.has(categoryId) ? categoryId : "";
}
