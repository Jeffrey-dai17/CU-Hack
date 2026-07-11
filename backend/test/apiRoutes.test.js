const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const serverPath = require.resolve("../src/server");
const goalRoutesPath = require.resolve("../src/routes/goalRoutes");
const recipeRoutesPath = require.resolve("../src/routes/recipeRoutes");
const swipeRoutesPath = require.resolve("../src/routes/swipeRoutes");
const geminiServicePath = require.resolve("../src/services/geminiService");
const spoonacularServicePath = require.resolve("../src/services/spoonacularService");
const memoryStorePath = require.resolve("../src/store/memoryStore");

function clearAppModules() {
  for (const modulePath of [
    serverPath,
    goalRoutesPath,
    recipeRoutesPath,
    swipeRoutesPath,
    geminiServicePath,
    spoonacularServicePath,
    memoryStorePath,
  ]) {
    delete require.cache[modulePath];
  }
}

function mockModule(modulePath, exports) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
  };
}

async function withTestServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

test.afterEach(() => {
  clearAppModules();
});

test("API routes expose the locked frontend contract", async () => {
  clearAppModules();
  const searchCalls = [];

  mockModule(geminiServicePath, {
    parseGoal: async (text) => {
      assert.equal(text, "vegan, quick");
      return { diet: "vegan", maxReadyTime: 30 };
    },
  });
  mockModule(spoonacularServicePath, {
    searchRecipes: async (filter) => {
      searchCalls.push(filter);
      return [
        {
          id: "abc123",
          title: "Vegan Demo",
          image: "https://example.com/vegan.jpg",
          readyInMinutes: 20,
          servings: 2,
          calories: 450,
          macros: { protein_g: 22, carbs_g: 50, fat_g: 10 },
          diets: ["vegan"],
          sourceUrl: "https://example.com/vegan-demo",
        },
      ];
    },
    getRecipeById: async (id) => ({
      id,
      title: "Recipe Detail",
      image: "https://example.com/detail.jpg",
      readyInMinutes: 35,
      servings: 4,
      calories: 520,
      macros: { protein_g: 32, carbs_g: 44, fat_g: 18 },
      diets: [],
      sourceUrl: "https://example.com/detail",
    }),
  });

  const app = require("../src/server");

  await withTestServer(app, async (baseUrl) => {
    assert.deepEqual(
      await requestJson(baseUrl, "/api/parse-goal", {
        method: "POST",
        body: JSON.stringify({ text: "vegan, quick" }),
      }),
      { status: 200, body: { parsedFilter: { diet: "vegan", maxReadyTime: 30 } } }
    );

    assert.deepEqual(
      await requestJson(baseUrl, "/api/goal", {
        method: "POST",
        body: JSON.stringify({
          userId: "demo-user-1",
          rawText: "vegan, under 500 calories",
          parsedFilter: { diet: "vegan", maxCalories: 500 },
        }),
      }),
      { status: 200, body: { success: true } }
    );

    const savedGoal = await requestJson(baseUrl, "/api/goal/current?userId=demo-user-1");
    assert.equal(savedGoal.status, 200);
    assert.equal(savedGoal.body.rawText, "vegan, under 500 calories");
    assert.deepEqual(savedGoal.body.parsedFilter, { diet: "vegan", maxCalories: 500 });
    assert.match(savedGoal.body.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

    const recipes = await requestJson(baseUrl, "/api/recipes?userId=demo-user-1");
    assert.equal(recipes.status, 200);
    assert.deepEqual(searchCalls[0], { diet: "vegan", maxCalories: 500 });
    assert.equal(recipes.body.recipes[0].id, "abc123");
    assert.equal(recipes.body.recipes[0].macros.protein_g, 22);

    assert.deepEqual(await requestJson(baseUrl, "/api/recipes/abc123"), {
      status: 200,
      body: {
        id: "abc123",
        title: "Recipe Detail",
        image: "https://example.com/detail.jpg",
        readyInMinutes: 35,
        servings: 4,
        calories: 520,
        macros: { protein_g: 32, carbs_g: 44, fat_g: 18 },
        diets: [],
        sourceUrl: "https://example.com/detail",
      },
    });

    assert.deepEqual(
      await requestJson(baseUrl, "/api/swipe", {
        method: "POST",
        body: JSON.stringify({ userId: "demo-user-1", recipeId: "abc123", direction: "right" }),
      }),
      { status: 200, body: { success: true } }
    );

    assert.deepEqual(
      await requestJson(baseUrl, "/api/swipe", {
        method: "POST",
        body: JSON.stringify({ userId: "demo-user-1", recipeId: "abc123", direction: "sideways" }),
      }),
      { status: 400, body: { error: "direction must be left or right" } }
    );
  });
});

test("goal validation errors match the contract", async () => {
  clearAppModules();
  mockModule(geminiServicePath, { parseGoal: async () => ({}) });
  mockModule(spoonacularServicePath, { searchRecipes: async () => [], getRecipeById: async () => ({}) });
  const app = require("../src/server");

  await withTestServer(app, async (baseUrl) => {
    assert.deepEqual(
      await requestJson(baseUrl, "/api/goal", {
        method: "POST",
        body: JSON.stringify({ userId: "demo-user-1" }),
      }),
      { status: 400, body: { error: "userId and rawText are required" } }
    );

    assert.deepEqual(await requestJson(baseUrl, "/api/goal/current?userId=missing"), {
      status: 200,
      body: null,
    });
  });
});

test("route service failures return 500 JSON errors", async () => {
  clearAppModules();
  mockModule(geminiServicePath, { parseGoal: async () => ({}) });
  mockModule(spoonacularServicePath, {
    searchRecipes: async () => {
      throw new Error("Spoonacular quota exceeded");
    },
    getRecipeById: async () => {
      throw new Error("Spoonacular detail failed");
    },
  });
  const app = require("../src/server");

  await withTestServer(app, async (baseUrl) => {
    assert.deepEqual(await requestJson(baseUrl, "/api/recipes?userId=demo-user-1"), {
      status: 500,
      body: { error: "Spoonacular quota exceeded" },
    });

    assert.deepEqual(await requestJson(baseUrl, "/api/recipes/abc123"), {
      status: 500,
      body: { error: "Spoonacular detail failed" },
    });
  });
});
