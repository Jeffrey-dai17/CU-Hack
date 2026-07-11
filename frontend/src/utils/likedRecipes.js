import { isUsableRecipe } from "./recipe.js";

const STORAGE_PREFIX = "recipe-match:liked:v1:";
const MAX_LIKED_RECIPES = 200;
const memorySnapshots = new Map();
const memoryFallbackKeys = new Set();

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function hasValidUserId(userId) {
  return typeof userId === "string" && userId.trim() !== "";
}

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const seenIds = new Set();
  const recipes = [];

  for (const recipe of value) {
    if (!isUsableRecipe(recipe) || seenIds.has(recipe.id)) {
      continue;
    }
    seenIds.add(recipe.id);
    recipes.push(recipe);
  }

  return recipes.slice(0, MAX_LIKED_RECIPES);
}

function cloneList(list) {
  try {
    return structuredClone(list);
  } catch {
    return null;
  }
}

function readMemoryList(key) {
  const list = normalizeList(memorySnapshots.get(key));
  return list ? cloneList(list) : [];
}

function rememberList(key, list, { fallback = false } = {}) {
  const clonedList = cloneList(list);
  if (!clonedList) {
    return false;
  }

  memorySnapshots.set(key, clonedList);
  if (fallback) {
    memoryFallbackKeys.add(key);
  } else {
    memoryFallbackKeys.delete(key);
  }
  return true;
}

export function getLikedRecipes(userId) {
  if (!hasValidUserId(userId)) {
    return [];
  }

  const key = getStorageKey(userId);

  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (rawValue == null) {
      if (memoryFallbackKeys.has(key)) {
        return readMemoryList(key);
      }
      memorySnapshots.delete(key);
      return [];
    }

    const list = normalizeList(JSON.parse(rawValue));
    if (!list) {
      window.sessionStorage.removeItem(key);
      const memoryList = readMemoryList(key);
      if (memoryList.length) {
        memoryFallbackKeys.add(key);
      }
      return memoryList;
    }
    rememberList(key, list);
    return cloneList(list) || [];
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage can be unavailable or blocked.
    }
    const memoryList = readMemoryList(key);
    if (memoryList.length) {
      memoryFallbackKeys.add(key);
    }
    return memoryList;
  }
}

export function addLikedRecipe(userId, recipe) {
  if (!hasValidUserId(userId) || !isUsableRecipe(recipe)) {
    return false;
  }

  const key = getStorageKey(userId);
  const existing = getLikedRecipes(userId);
  const nextList = normalizeList([recipe, ...existing.filter((item) => item.id !== recipe.id)]);
  if (!nextList) {
    return false;
  }

  if (!rememberList(key, nextList, { fallback: true })) {
    return false;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(nextList));
    memoryFallbackKeys.delete(key);
    return true;
  } catch {
    return false;
  }
}

export function clearLikedRecipes(userId) {
  if (!hasValidUserId(userId)) {
    return false;
  }

  const key = getStorageKey(userId);
  memorySnapshots.delete(key);
  memoryFallbackKeys.delete(key);

  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
