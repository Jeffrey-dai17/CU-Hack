const { normalizeGoalFilter } = require("./goalFilter");

const SPOONACULAR_BASE_URL = "https://api.spoonacular.com";
const DEFAULT_SPOONACULAR_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120000;
const MIN_SEARCH_LIMIT = 1;
const MAX_SEARCH_LIMIT = 20;
const MAX_SEARCH_OFFSET = 900;
const MAX_ERROR_BODY_LENGTH = 1000;

class SpoonacularServiceError extends Error {
  constructor({ code, statusCode, publicMessage, retryable = false, cause }) {
    super(publicMessage, cause === undefined ? undefined : { cause });
    this.name = "SpoonacularServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
    this.retryable = retryable;
  }
}

function readBoundedInteger(name, fallback, min, max) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;

  const value = Number(rawValue);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function getApiKey() {
  const apiKey = String(process.env.SPOONACULAR_API_KEY || "").trim();
  if (!apiKey) {
    throw new SpoonacularServiceError({
      code: "SPOONACULAR_NOT_CONFIGURED",
      statusCode: 503,
      publicMessage: "Recipe service is not configured",
    });
  }

  return apiKey;
}

function getTimeoutMs() {
  return readBoundedInteger(
    "SPOONACULAR_TIMEOUT_MS",
    DEFAULT_SPOONACULAR_TIMEOUT_MS,
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );
}

function isTimeoutError(error, signal, depth = 0) {
  if (signal?.aborted) return true;
  if (!error || depth > 3) return false;
  if (["AbortError", "TimeoutError"].includes(error.name)) return true;
  if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(error.code)) {
    return true;
  }
  if (/timed?\s*out|timeout/i.test(String(error.message || ""))) return true;
  return isTimeoutError(error.cause, signal, depth + 1);
}

function compactProviderBody(body) {
  return String(body || "").replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_BODY_LENGTH);
}

function providerFailureCause(label, status, body, cause) {
  const detail = compactProviderBody(body);
  const message = `${label} returned HTTP ${status}${detail ? `: ${detail}` : ""}`;
  return new Error(message, cause === undefined ? undefined : { cause });
}

function invalidResponseError(label, cause) {
  return new SpoonacularServiceError({
    code: "SPOONACULAR_INVALID_RESPONSE",
    statusCode: 502,
    publicMessage: "Recipe service returned an invalid response",
    retryable: true,
    cause: cause || new Error(`${label} returned an invalid response`),
  });
}

function timeoutError(cause) {
  return new SpoonacularServiceError({
    code: "SPOONACULAR_TIMEOUT",
    statusCode: 504,
    publicMessage: "Recipe service timed out",
    retryable: true,
    cause,
  });
}

async function fetchJsonOrThrow(url, { label, notFoundIs404 = false }) {
  const signal = AbortSignal.timeout(getTimeoutMs());
  let response;

  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  } catch (cause) {
    if (isTimeoutError(cause, signal)) throw timeoutError(cause);

    throw new SpoonacularServiceError({
      code: "SPOONACULAR_UPSTREAM_ERROR",
      statusCode: 502,
      publicMessage: "Recipe service is temporarily unavailable",
      retryable: true,
      cause,
    });
  }

  if (!response || typeof response.ok !== "boolean") {
    throw invalidResponseError(label);
  }

  if (!response.ok) {
    let body = "";
    let bodyReadError;
    try {
      body = await response.text();
    } catch (cause) {
      if (isTimeoutError(cause, signal)) throw timeoutError(cause);
      bodyReadError = cause;
    }

    const cause = providerFailureCause(label, response.status, body, bodyReadError);
    if (notFoundIs404 && response.status === 404) {
      throw new SpoonacularServiceError({
        code: "RECIPE_NOT_FOUND",
        statusCode: 404,
        publicMessage: "Recipe not found",
        cause,
      });
    }

    throw new SpoonacularServiceError({
      code: "SPOONACULAR_UPSTREAM_ERROR",
      statusCode: 502,
      publicMessage: "Recipe service is temporarily unavailable",
      retryable: response.status === 429 || response.status >= 500,
      cause,
    });
  }

  try {
    return await response.json();
  } catch (cause) {
    if (isTimeoutError(cause, signal)) throw timeoutError(cause);
    throw invalidResponseError(label, cause);
  }
}

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHttpUrl(value) {
  const text = normalizeOptionalString(value);
  if (!text) return "";

  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.toString();
  } catch (_error) {
    return "";
  }
}

function normalizeNonNegativeNumber(value) {
  if (typeof value === "string" && value.trim() === "") return null;
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function normalizeUpstreamRecipeId(value) {
  const text = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!/^[1-9]\d*$/.test(text)) return null;

  const number = Number(text);
  return Number.isSafeInteger(number) ? String(number) : null;
}

function normalizeDiets(value) {
  if (!Array.isArray(value)) return [];

  const diets = [];
  const seen = new Set();
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const diet = candidate.trim();
    if (!diet) continue;
    const key = diet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    diets.push(diet);
  }
  return diets;
}

function getNutrientAmount(nutrients, name) {
  if (!Array.isArray(nutrients)) return null;
  const nutrient = nutrients.find((item) => item && item.name === name);
  return nutrient ? normalizeNonNegativeNumber(nutrient.amount) : null;
}

function normalizeRecipe(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const id = normalizeUpstreamRecipeId(item.id);
  const title = normalizeOptionalString(item.title);
  if (!id || !title) return null;

  const nutrients = item?.nutrition?.nutrients;
  return {
    id,
    title,
    image: normalizeHttpUrl(item.image),
    readyInMinutes: normalizeNonNegativeNumber(item.readyInMinutes),
    servings: normalizeNonNegativeNumber(item.servings),
    calories: getNutrientAmount(nutrients, "Calories"),
    macros: {
      protein_g: getNutrientAmount(nutrients, "Protein"),
      carbs_g: getNutrientAmount(nutrients, "Carbohydrates"),
      fat_g: getNutrientAmount(nutrients, "Fat"),
    },
    diets: normalizeDiets(item.diets),
    sourceUrl: normalizeHttpUrl(item.sourceUrl),
  };
}

function normalizeSearchOptions(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new SpoonacularServiceError({
      code: "INVALID_SEARCH_OPTIONS",
      statusCode: 400,
      publicMessage: "Invalid recipe search options",
    });
  }

  const limit = options.limit === undefined ? 10 : options.limit;
  const offset = options.offset === undefined ? 0 : options.offset;
  if (
    !Number.isInteger(limit) ||
    limit < MIN_SEARCH_LIMIT ||
    limit > MAX_SEARCH_LIMIT ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > MAX_SEARCH_OFFSET
  ) {
    throw new SpoonacularServiceError({
      code: "INVALID_SEARCH_OPTIONS",
      statusCode: 400,
      publicMessage: "Invalid recipe search options",
    });
  }

  return { limit, offset };
}

async function searchRecipes(parsedFilter = {}, options = {}) {
  const filter = normalizeGoalFilter(parsedFilter);
  const { limit, offset } = normalizeSearchOptions(options);
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apiKey,
    number: String(limit),
    offset: String(offset),
    addRecipeInformation: "true",
    addRecipeNutrition: "true",
  });

  if (filter.maxCalories !== undefined) params.set("maxCalories", String(filter.maxCalories));
  if (filter.maxReadyTime !== undefined) params.set("maxReadyTime", String(filter.maxReadyTime));
  if (filter.diet !== undefined) params.set("diet", filter.diet);
  if (filter.minProtein_g !== undefined) params.set("minProtein", String(filter.minProtein_g));
  if (filter.excludeIngredients?.length) {
    params.set("excludeIngredients", filter.excludeIngredients.join(","));
  }

  const data = await fetchJsonOrThrow(
    `${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params.toString()}`,
    { label: "Spoonacular recipe search" }
  );

  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.results)) {
    throw invalidResponseError("Spoonacular recipe search");
  }

  return data.results.slice(0, limit).map(normalizeRecipe).filter(Boolean);
}

function normalizeRecipeId(id) {
  const normalizedId = normalizeUpstreamRecipeId(id);
  if (!normalizedId) {
    throw new SpoonacularServiceError({
      code: "INVALID_RECIPE_ID",
      statusCode: 400,
      publicMessage: "Recipe id must be a positive integer",
    });
  }
  return normalizedId;
}

async function getRecipeById(id) {
  const recipeId = normalizeRecipeId(id);
  const apiKey = getApiKey();
  const params = new URLSearchParams({ apiKey, includeNutrition: "true" });
  const data = await fetchJsonOrThrow(
    `${SPOONACULAR_BASE_URL}/recipes/${recipeId}/information?${params.toString()}`,
    { label: "Spoonacular recipe detail", notFoundIs404: true }
  );

  const recipe = normalizeRecipe(data);
  if (!recipe) throw invalidResponseError("Spoonacular recipe detail");
  return recipe;
}

module.exports = {
  DEFAULT_SPOONACULAR_TIMEOUT_MS,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_OFFSET,
  SpoonacularServiceError,
  fetchRecipeById: getRecipeById,
  fetchRecipesForGoal: searchRecipes,
  getFallbackRecipeById: () => null,
  getRecipeById,
  normalizeRecipe,
  searchRecipes,
};
