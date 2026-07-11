const ALLOWED_DIETS = Object.freeze([
  "gluten free",
  "ketogenic",
  "vegetarian",
  "lacto-vegetarian",
  "ovo-vegetarian",
  "vegan",
  "pescetarian",
  "paleo",
  "primal",
  "low fodmap",
  "whole30",
]);

const GOAL_FILTER_FIELDS = Object.freeze([
  "maxCalories",
  "minProtein_g",
  "diet",
  "maxReadyTime",
  "excludeIngredients",
]);

const FILTER_LIMITS = Object.freeze({
  maxCalories: Object.freeze({ min: 1, max: 10000 }),
  minProtein_g: Object.freeze({ min: 0, max: 500 }),
  maxReadyTime: Object.freeze({ min: 1, max: 1440 }),
  excludeIngredients: Object.freeze({ maxItems: 20, maxItemLength: 80 }),
});

const GOAL_FILTER_JSON_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    maxCalories: {
      type: "integer",
      minimum: FILTER_LIMITS.maxCalories.min,
      maximum: FILTER_LIMITS.maxCalories.max,
    },
    minProtein_g: {
      type: "integer",
      minimum: FILTER_LIMITS.minProtein_g.min,
      maximum: FILTER_LIMITS.minProtein_g.max,
    },
    diet: { type: "string", enum: [...ALLOWED_DIETS] },
    maxReadyTime: {
      type: "integer",
      minimum: FILTER_LIMITS.maxReadyTime.min,
      maximum: FILTER_LIMITS.maxReadyTime.max,
    },
    excludeIngredients: {
      type: "array",
      maxItems: FILTER_LIMITS.excludeIngredients.maxItems,
      items: { type: "string" },
    },
  },
  propertyOrdering: [...GOAL_FILTER_FIELDS],
});

class GoalFilterValidationError extends Error {
  constructor(details) {
    super("Invalid goal filter");
    this.name = "GoalFilterValidationError";
    this.statusCode = 400;
    this.code = "INVALID_GOAL_FILTER";
    this.publicMessage = "Invalid goal filter";
    this.retryable = false;
    this.details = Array.isArray(details) ? details : [String(details)];
  }
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeGoalFilter(value, { strict = false } = {}) {
  if (value === undefined) return {};

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (strict) throw new GoalFilterValidationError(["filter must be an object"]);
    return {};
  }

  const normalized = {};
  const errors = [];
  const allowedFields = new Set(GOAL_FILTER_FIELDS);
  const addError = (message) => {
    if (errors.length < 10) errors.push(message);
  };

  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) addError(`${field} is not a supported filter field`);
  }

  for (const field of ["maxCalories", "minProtein_g", "maxReadyTime"]) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) continue;

    const candidate = value[field];
    const { min, max } = FILTER_LIMITS[field];
    if (
      typeof candidate !== "number" ||
      !Number.isFinite(candidate) ||
      !Number.isInteger(candidate) ||
      candidate < min ||
      candidate > max
    ) {
      addError(`${field} must be an integer between ${min} and ${max}`);
      continue;
    }

    normalized[field] = candidate;
  }

  if (Object.prototype.hasOwnProperty.call(value, "diet")) {
    if (typeof value.diet !== "string") {
      addError("diet must be a supported string value");
    } else {
      const diet = normalizeWhitespace(value.diet).toLowerCase();
      if (!ALLOWED_DIETS.includes(diet)) {
        addError("diet must be a supported string value");
      } else {
        normalized.diet = diet;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, "excludeIngredients")) {
    if (!Array.isArray(value.excludeIngredients)) {
      addError("excludeIngredients must be an array of ingredient names");
    } else {
      const { maxItems, maxItemLength } = FILTER_LIMITS.excludeIngredients;
      if (value.excludeIngredients.length > maxItems) {
        addError(`excludeIngredients must contain no more than ${maxItems} items`);
      }

      const ingredients = [];
      const seen = new Set();
      const candidates = value.excludeIngredients.slice(0, strict ? maxItems : maxItems * 5);
      for (const candidate of candidates) {
        if (ingredients.length >= maxItems) break;

        if (typeof candidate !== "string") {
          addError("excludeIngredients entries must be strings");
          continue;
        }

        const ingredient = normalizeWhitespace(candidate);
        if (!ingredient || ingredient.length > maxItemLength) {
          addError(
            `excludeIngredients entries must be between 1 and ${maxItemLength} characters`
          );
          continue;
        }

        const dedupeKey = ingredient.toLowerCase();
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        ingredients.push(ingredient);
      }

      if (ingredients.length > 0) normalized.excludeIngredients = ingredients;
    }
  }

  if (strict && errors.length > 0) throw new GoalFilterValidationError(errors);
  return normalized;
}

module.exports = {
  ALLOWED_DIETS,
  FILTER_LIMITS,
  GOAL_FILTER_FIELDS,
  GOAL_FILTER_JSON_SCHEMA,
  GoalFilterValidationError,
  normalizeGoalFilter,
};
