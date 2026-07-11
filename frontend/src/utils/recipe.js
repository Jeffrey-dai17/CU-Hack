function isUsableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function formatCalories(value) {
  return isUsableNumber(value) ? `${Math.round(value)} kcal` : "Calories N/A";
}

export function formatMacro(value) {
  return isUsableNumber(value) ? `${Math.round(value)}g` : "N/A";
}

export function formatTime(value) {
  return isUsableNumber(value) ? `${Math.round(value)} min` : "Time N/A";
}

export function formatServings(value) {
  if (!isUsableNumber(value)) {
    return "";
  }

  const servings = Math.round(value);
  if (servings <= 0) {
    return "";
  }

  return `${servings} ${servings === 1 ? "serving" : "servings"}`;
}

export function normalizeImageUrl(value) {
  return typeof value === "string" ? value.trim() : "";
}
