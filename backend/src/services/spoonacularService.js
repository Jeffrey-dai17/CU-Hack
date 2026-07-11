// searchRecipes finds matching Spoonacular recipes; getRecipeById fetches one full recipe.

const SPOONACULAR_BASE_URL = "https://api.spoonacular.com";

function getApiKey() {
  if (!process.env.SPOONACULAR_API_KEY) {
    throw new Error("SPOONACULAR_API_KEY is required");
  }

  return process.env.SPOONACULAR_API_KEY;
}

function addPresentParam(params, key, value) {
  if (value === undefined || value === null || value === "") return;
  params.set(key, String(value));
}

function getNutrientAmount(nutrients, name) {
  const nutrient = Array.isArray(nutrients)
    ? nutrients.find((item) => item.name === name)
    : null;

  return nutrient ? Math.round(Number(nutrient.amount) || 0) : 0;
}

function normalizeRecipe(item) {
  const nutrients = item?.nutrition?.nutrients || [];

  return {
    id: String(item.id),
    title: item.title,
    image: item.image,
    readyInMinutes: item.readyInMinutes,
    servings: item.servings,
    calories: getNutrientAmount(nutrients, "Calories"),
    macros: {
      protein_g: getNutrientAmount(nutrients, "Protein"),
      carbs_g: getNutrientAmount(nutrients, "Carbohydrates"),
      fat_g: getNutrientAmount(nutrients, "Fat"),
    },
    diets: item.diets || [],
    sourceUrl: item.sourceUrl || "",
  };
}

async function fetchJsonOrThrow(url, label) {
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} failed with status ${response.status}: ${body}`);
  }

  return response.json();
}

async function searchRecipes(parsedFilter = {}) {
  const params = new URLSearchParams({
    apiKey: getApiKey(),
    number: "10",
    addRecipeNutrition: "true",
  });

  addPresentParam(params, "maxCalories", parsedFilter.maxCalories);
  addPresentParam(params, "maxReadyTime", parsedFilter.maxReadyTime);
  addPresentParam(params, "diet", parsedFilter.diet);
  addPresentParam(params, "minProtein", parsedFilter.minProtein_g);

  if (
    Array.isArray(parsedFilter.excludeIngredients) &&
    parsedFilter.excludeIngredients.length > 0
  ) {
    params.set("excludeIngredients", parsedFilter.excludeIngredients.join(","));
  }

  const data = await fetchJsonOrThrow(
    `${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params.toString()}`,
    "Spoonacular recipe search"
  );

  return Array.isArray(data.results) ? data.results.map(normalizeRecipe) : [];
}

async function getRecipeById(id) {
  const params = new URLSearchParams({
    apiKey: getApiKey(),
    includeNutrition: "true",
  });

  const data = await fetchJsonOrThrow(
    `${SPOONACULAR_BASE_URL}/recipes/${encodeURIComponent(id)}/information?${params.toString()}`,
    "Spoonacular recipe detail"
  );

  return normalizeRecipe(data);
}

module.exports = {
  searchRecipes,
  getRecipeById,
  fetchRecipesForGoal: searchRecipes,
  fetchRecipeById: getRecipeById,
  getFallbackRecipeById: () => null,
};
