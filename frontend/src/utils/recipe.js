function isUsableNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function normalizeRecipeId(value) {
  if (typeof value !== "string") {
    return "";
  }

  const id = value.trim();
  if (!/^[1-9]\d*$/.test(id)) {
    return "";
  }

  const numericId = Number(id);
  return Number.isSafeInteger(numericId) && String(numericId) === id ? id : "";
}

export function isUsableRecipe(recipe) {
  const normalizedId = normalizeRecipeId(recipe?.id);
  return Boolean(
    recipe &&
      typeof recipe === "object" &&
      !Array.isArray(recipe) &&
      normalizedId &&
      normalizedId === recipe.id,
  );
}

export function getSafeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

export function formatCalories(value) {
  return isUsableNumber(value) ? `${Math.round(value)} kcal` : "Calories N/A";
}

/** Formats a recipe's total calories for the selected number of people. */
export function formatCaloriesForPeople(calories, servings, people = 1) {
  if (!isUsableNumber(calories)) {
    return "Calories N/A";
  }

  const roundedServings = isUsableNumber(servings) ? Math.round(servings) : 0;
  const roundedPeople = isUsableNumber(people) ? Math.round(people) : 0;

  if (roundedServings <= 0 || roundedPeople <= 0) {
    return formatCalories(calories);
  }

  return formatCalories((calories / roundedServings) * roundedPeople);
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
  return getSafeHttpUrl(value);
}
