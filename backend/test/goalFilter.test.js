const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ALLOWED_DIETS,
  FILTER_LIMITS,
  GOAL_FILTER_FIELDS,
  GOAL_FILTER_JSON_SCHEMA,
  GoalFilterValidationError,
  normalizeGoalFilter,
} = require("../src/services/goalFilter");

test("normalizeGoalFilter canonicalizes supported fields without mutating input", () => {
  const input = {
    maxCalories: 650,
    minProtein_g: 30,
    diet: "  Low   FODMAP ",
    maxReadyTime: 45,
    excludeIngredients: [
      " Peanuts ",
      "peanuts",
      "  green   onions  ",
      "",
      42,
      "x".repeat(81),
    ],
    unexpected: true,
  };

  assert.deepEqual(normalizeGoalFilter(input), {
    maxCalories: 650,
    minProtein_g: 30,
    diet: "low fodmap",
    maxReadyTime: 45,
    excludeIngredients: ["Peanuts", "green onions"],
  });
  assert.equal(input.diet, "  Low   FODMAP ");
  assert.equal(input.excludeIngredients.length, 6);
});

test("non-strict normalization strips invalid roots, values, and unknown fields", () => {
  assert.deepEqual(normalizeGoalFilter(null), {});
  assert.deepEqual(normalizeGoalFilter([]), {});
  assert.deepEqual(normalizeGoalFilter("vegan"), {});
  assert.deepEqual(
    normalizeGoalFilter({
      maxCalories: "500",
      minProtein_g: -1,
      maxReadyTime: 3.5,
      diet: "carnivore",
      excludeIngredients: "peanuts",
      query: "pizza",
    }),
    {}
  );
});

test("non-strict ingredient normalization deduplicates and enforces the item cap", () => {
  const ingredients = Array.from({ length: 30 }, (_, index) => ` ingredient ${index} `);
  ingredients.splice(1, 0, "INGREDIENT 0");

  const normalized = normalizeGoalFilter({ excludeIngredients: ingredients });
  assert.equal(normalized.excludeIngredients.length, FILTER_LIMITS.excludeIngredients.maxItems);
  assert.deepEqual(normalized.excludeIngredients.slice(0, 2), ["ingredient 0", "ingredient 1"]);
});

test("strict normalization returns canonical valid data", () => {
  assert.deepEqual(
    normalizeGoalFilter(
      {
        maxCalories: 1,
        minProtein_g: 0,
        diet: " Vegan ",
        maxReadyTime: 1440,
        excludeIngredients: [" soy ", "SOY"],
      },
      { strict: true }
    ),
    {
      maxCalories: 1,
      minProtein_g: 0,
      diet: "vegan",
      maxReadyTime: 1440,
      excludeIngredients: ["soy"],
    }
  );
  assert.deepEqual(normalizeGoalFilter(undefined, { strict: true }), {});
});

test("strict normalization throws a safe, actionable validation error", () => {
  assert.throws(
    () =>
      normalizeGoalFilter(
        {
          maxCalories: 0,
          minProtein_g: 501,
          maxReadyTime: Infinity,
          diet: "anything",
          excludeIngredients: [null, ""],
          extra: "field",
        },
        { strict: true }
      ),
    (error) => {
      assert.ok(error instanceof GoalFilterValidationError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "INVALID_GOAL_FILTER");
      assert.equal(error.publicMessage, "Invalid goal filter");
      assert.equal(error.retryable, false);
      assert.ok(error.details.some((detail) => detail.includes("maxCalories")));
      assert.ok(error.details.some((detail) => detail.includes("extra")));
      assert.doesNotMatch(error.message, /Infinity|anything/);
      return true;
    }
  );
});

test("strict normalization rejects invalid roots and oversized ingredient arrays", () => {
  assert.throws(
    () => normalizeGoalFilter(null, { strict: true }),
    (error) => error.code === "INVALID_GOAL_FILTER" && error.details[0] === "filter must be an object"
  );

  assert.throws(
    () =>
      normalizeGoalFilter(
        {
          excludeIngredients: Array.from(
            { length: FILTER_LIMITS.excludeIngredients.maxItems + 1 },
            (_, index) => `item-${index}`
          ),
        },
        { strict: true }
      ),
    (error) => error.details.some((detail) => detail.includes("no more than 20"))
  );
});

test("the Gemini response schema matches the canonical filter contract", () => {
  assert.deepEqual(Object.keys(GOAL_FILTER_JSON_SCHEMA.properties), GOAL_FILTER_FIELDS);
  assert.equal(GOAL_FILTER_JSON_SCHEMA.additionalProperties, false);
  assert.deepEqual(GOAL_FILTER_JSON_SCHEMA.properties.diet.enum, ALLOWED_DIETS);
  assert.equal(
    GOAL_FILTER_JSON_SCHEMA.properties.excludeIngredients.maxItems,
    FILTER_LIMITS.excludeIngredients.maxItems
  );
  assert.equal(
    GOAL_FILTER_JSON_SCHEMA.properties.maxCalories.maximum,
    FILTER_LIMITS.maxCalories.max
  );
});
