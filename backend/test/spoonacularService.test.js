const assert = require("node:assert/strict");
const test = require("node:test");

const servicePath = require.resolve("../src/services/spoonacularService");

function loadService() {
  delete require.cache[servicePath];
  return require("../src/services/spoonacularService");
}

test.afterEach(() => {
  delete process.env.SPOONACULAR_API_KEY;
  delete global.fetch;
  delete require.cache[servicePath];
});

test("searchRecipes builds only present query params and normalizes nutrition", async () => {
  process.env.SPOONACULAR_API_KEY = "spoon-key";
  let requestedUrl;
  global.fetch = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      async json() {
        return {
          results: [
            {
              id: 123,
              title: "Vegan Bowl",
              image: "https://example.com/image.jpg",
              readyInMinutes: 25,
              servings: 2,
              diets: ["vegan"],
              sourceUrl: "https://example.com/recipe",
              nutrition: {
                nutrients: [
                  { name: "Calories", amount: 499.7, unit: "kcal" },
                  { name: "Protein", amount: 31.2, unit: "g" },
                  { name: "Carbohydrates", amount: 45.5, unit: "g" },
                  { name: "Fat", amount: 12.1, unit: "g" },
                ],
              },
            },
          ],
        };
      },
    };
  };

  const { searchRecipes } = loadService();
  const recipes = await searchRecipes({
    maxCalories: 500,
    diet: "vegan",
    excludeIngredients: ["peanuts", "shellfish"],
  });

  assert.equal(requestedUrl.origin, "https://api.spoonacular.com");
  assert.equal(requestedUrl.pathname, "/recipes/complexSearch");
  assert.equal(requestedUrl.searchParams.get("apiKey"), "spoon-key");
  assert.equal(requestedUrl.searchParams.get("number"), "10");
  assert.equal(requestedUrl.searchParams.get("addRecipeNutrition"), "true");
  assert.equal(requestedUrl.searchParams.get("maxCalories"), "500");
  assert.equal(requestedUrl.searchParams.get("diet"), "vegan");
  assert.equal(requestedUrl.searchParams.get("excludeIngredients"), "peanuts,shellfish");
  assert.equal(requestedUrl.searchParams.has("maxReadyTime"), false);
  assert.equal(requestedUrl.searchParams.has("minProtein"), false);
  assert.deepEqual(recipes, [
    {
      id: "123",
      title: "Vegan Bowl",
      image: "https://example.com/image.jpg",
      readyInMinutes: 25,
      servings: 2,
      calories: 500,
      macros: { protein_g: 31, carbs_g: 46, fat_g: 12 },
      diets: ["vegan"],
      sourceUrl: "https://example.com/recipe",
    },
  ]);
});

test("getRecipeById requests includeNutrition and returns the locked recipe shape", async () => {
  process.env.SPOONACULAR_API_KEY = "spoon-key";
  let requestedUrl;
  global.fetch = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      async json() {
        return {
          id: 456,
          title: "Chicken Plate",
          image: "https://example.com/chicken.jpg",
          readyInMinutes: 40,
          servings: 4,
          diets: [],
          nutrition: {
            nutrients: [
              { name: "Calories", amount: 601, unit: "kcal" },
              { name: "Protein", amount: 44.9, unit: "g" },
            ],
          },
        };
      },
    };
  };

  const { getRecipeById } = loadService();
  const recipe = await getRecipeById("456");

  assert.equal(requestedUrl.pathname, "/recipes/456/information");
  assert.equal(requestedUrl.searchParams.get("apiKey"), "spoon-key");
  assert.equal(requestedUrl.searchParams.get("includeNutrition"), "true");
  assert.deepEqual(recipe, {
    id: "456",
    title: "Chicken Plate",
    image: "https://example.com/chicken.jpg",
    readyInMinutes: 40,
    servings: 4,
    calories: 601,
    macros: { protein_g: 45, carbs_g: 0, fat_g: 0 },
    diets: [],
    sourceUrl: "",
  });
});

test("Spoonacular failures include status code and response body", async () => {
  process.env.SPOONACULAR_API_KEY = "spoon-key";
  global.fetch = async () => ({
    ok: false,
    status: 402,
    async text() {
      return "quota exceeded";
    },
  });

  const { searchRecipes } = loadService();

  await assert.rejects(
    () => searchRecipes({ minProtein_g: 30 }),
    /Spoonacular recipe search failed with status 402: quota exceeded/
  );
});
