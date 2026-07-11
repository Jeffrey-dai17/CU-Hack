const USER_ID_MAX_LENGTH = 128;
const GOAL_TEXT_MAX_LENGTH = 1000;

function createHttpError(statusCode, publicMessage, message = publicMessage) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

function requireBoundedString(value, { field, maxLength, missingMessage }) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createHttpError(400, missingMessage || `${field} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw createHttpError(400, `${field} must be at most ${maxLength} characters`);
  }

  return normalized;
}

function requireSingleQueryValue(query, field) {
  const value = query?.[field];
  if (Array.isArray(value)) {
    throw createHttpError(400, `${field} must be provided once`);
  }
  return value;
}

function parseIntegerQuery(value, { field, min, max, defaultValue }) {
  if (value === undefined) return defaultValue;

  const normalized = typeof value === "string" ? value.trim() : "";
  if (!/^\d+$/.test(normalized)) {
    throw createHttpError(400, `${field} must be an integer between ${min} and ${max}`);
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw createHttpError(400, `${field} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

function requirePositiveRecipeId(value, field = "recipeId") {
  const normalized = requireBoundedString(value, {
    field,
    maxLength: 32,
  });
  const parsed = Number(normalized);

  if (!/^[1-9]\d*$/.test(normalized) || !Number.isSafeInteger(parsed)) {
    throw createHttpError(400, `${field} must be a positive integer`);
  }

  return normalized;
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}

module.exports = {
  GOAL_TEXT_MAX_LENGTH,
  USER_ID_MAX_LENGTH,
  asyncRoute,
  createHttpError,
  parseIntegerQuery,
  requireBoundedString,
  requirePositiveRecipeId,
  requireSingleQueryValue,
};
