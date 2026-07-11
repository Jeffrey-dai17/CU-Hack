const { GoogleGenAI } = require("@google/genai");

const { GOAL_FILTER_JSON_SCHEMA, normalizeGoalFilter } = require("./goalFilter");

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_GEMINI_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 120000;
const MAX_GOAL_TEXT_LENGTH = 1000;

const SYSTEM_INSTRUCTION = [
  "Convert a food-related goal into a recipe search filter.",
  "Return only fields that the user clearly implies. An unconstrained goal must return an empty object.",
  "maxReadyTime is measured in minutes. minProtein_g is measured in grams.",
  "Map diet intent to the closest value allowed by the response schema; omit diet when none fits.",
  "Examples:",
  'Input: "cutting carbs, high protein, something quick"',
  'Output: {"minProtein_g": 30, "maxReadyTime": 30}',
  'Input: "vegan, no peanuts, under 600 calories"',
  'Output: {"diet": "vegan", "excludeIngredients": ["peanuts"], "maxCalories": 600}',
  'Input: "just something tasty"',
  "Output: {}",
  'Input: "keto, dinner in under an hour"',
  'Output: {"diet": "ketogenic", "maxReadyTime": 60}',
].join("\n");

class GeminiServiceError extends Error {
  constructor({ code, statusCode, publicMessage, retryable = false, cause }) {
    super(publicMessage, cause === undefined ? undefined : { cause });
    this.name = "GeminiServiceError";
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

function getGeminiConfig() {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new GeminiServiceError({
      code: "GEMINI_NOT_CONFIGURED",
      statusCode: 503,
      publicMessage: "Goal parsing service is not configured",
    });
  }

  return {
    apiKey,
    model: String(process.env.GEMINI_MODEL || "").trim() || DEFAULT_GEMINI_MODEL,
    timeoutMs: readBoundedInteger(
      "GEMINI_TIMEOUT_MS",
      DEFAULT_GEMINI_TIMEOUT_MS,
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS
    ),
  };
}

function normalizeGoalText(rawText) {
  if (typeof rawText !== "string" || rawText.trim() === "") {
    throw new GeminiServiceError({
      code: "INVALID_GOAL_TEXT",
      statusCode: 400,
      publicMessage: "Goal text is required",
    });
  }

  const text = rawText.trim();
  if (text.length > MAX_GOAL_TEXT_LENGTH) {
    throw new GeminiServiceError({
      code: "INVALID_GOAL_TEXT",
      statusCode: 400,
      publicMessage: `Goal text must be ${MAX_GOAL_TEXT_LENGTH} characters or fewer`,
    });
  }

  return text;
}

function stripMarkdownFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isTimeoutError(error, depth = 0) {
  if (!error || depth > 3) return false;
  if (["AbortError", "TimeoutError"].includes(error.name)) return true;
  if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(error.code)) {
    return true;
  }
  if ([408, 504].includes(error.status)) return true;
  if (/timed?\s*out|timeout/i.test(String(error.message || ""))) return true;
  return isTimeoutError(error.cause, depth + 1);
}

async function parseGoal(rawText) {
  const text = normalizeGoalText(rawText);
  const { apiKey, model, timeoutMs } = getGeminiConfig();
  const abortSignal = AbortSignal.timeout(timeoutMs);

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } });
    const response = await ai.models.generateContent({
      model,
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: GOAL_FILTER_JSON_SCHEMA,
        temperature: 0,
        maxOutputTokens: 512,
        abortSignal,
      },
    });

    const responseText = stripMarkdownFences(response?.text);
    if (!responseText) {
      throw new GeminiServiceError({
        code: "GEMINI_INVALID_RESPONSE",
        statusCode: 502,
        publicMessage: "Goal parsing service returned an invalid response",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (cause) {
      throw new GeminiServiceError({
        code: "GEMINI_INVALID_RESPONSE",
        statusCode: 502,
        publicMessage: "Goal parsing service returned an invalid response",
        cause,
      });
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new GeminiServiceError({
        code: "GEMINI_INVALID_RESPONSE",
        statusCode: 502,
        publicMessage: "Goal parsing service returned an invalid response",
      });
    }

    return normalizeGoalFilter(parsed);
  } catch (error) {
    if (error instanceof GeminiServiceError) throw error;
    if (abortSignal.aborted || isTimeoutError(error)) {
      throw new GeminiServiceError({
        code: "GEMINI_TIMEOUT",
        statusCode: 504,
        publicMessage: "Goal parsing service timed out",
        retryable: true,
        cause: error,
      });
    }

    throw new GeminiServiceError({
      code: "GEMINI_UPSTREAM_ERROR",
      statusCode: 502,
      publicMessage: "Goal parsing service is temporarily unavailable",
      retryable: true,
      cause: error,
    });
  }
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_TIMEOUT_MS,
  GeminiServiceError,
  parseGoal,
  parseGoalWithGemini: parseGoal,
};
