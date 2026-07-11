import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLikedRecipe,
  clearLikedRecipes,
  DEMO_LIKED_RECIPE,
  getLikedRecipes,
} from "./likedRecipes.js";

const USER_ID = "demo-user-1";
const RECIPE_A = {
  id: "12345",
  title: "Vegan Bowl",
  image: "https://images.example/vegan-bowl.jpg",
  readyInMinutes: 25,
  servings: 2,
  calories: 480,
  macros: { protein_g: 38, carbs_g: 42, fat_g: 14 },
};
const RECIPE_B = {
  id: "67890",
  title: "Chicken Stir Fry",
  image: "https://images.example/stir-fry.jpg",
  readyInMinutes: 20,
  servings: 4,
  calories: 520,
  macros: { protein_g: 40, carbs_g: 30, fat_g: 18 },
};

describe("liked recipes storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearLikedRecipes(USER_ID);
    clearLikedRecipes("another-user");
    window.sessionStorage.clear();
  });

  it("starts with the demo recipe for the configured demo user", () => {
    expect(getLikedRecipes(USER_ID)).toEqual([DEMO_LIKED_RECIPE]);
  });

  it("adds liked recipes newest-first ahead of the pinned demo recipe", () => {
    expect(addLikedRecipe(USER_ID, RECIPE_A)).toBe(true);
    expect(addLikedRecipe(USER_ID, RECIPE_B)).toBe(true);
    expect(getLikedRecipes(USER_ID)).toEqual([RECIPE_B, RECIPE_A, DEMO_LIKED_RECIPE]);
  });

  it("dedupes by recipe id and moves the repeat like to the front", () => {
    addLikedRecipe(USER_ID, RECIPE_A);
    addLikedRecipe(USER_ID, RECIPE_B);
    addLikedRecipe(USER_ID, RECIPE_A);

    expect(getLikedRecipes(USER_ID)).toEqual([RECIPE_A, RECIPE_B, DEMO_LIKED_RECIPE]);
  });

  it("rejects unusable recipes and missing user ids without throwing", () => {
    expect(addLikedRecipe(USER_ID, { id: "not-numeric" })).toBe(false);
    expect(addLikedRecipe(USER_ID, null)).toBe(false);
    expect(addLikedRecipe("", RECIPE_A)).toBe(false);
    expect(getLikedRecipes(USER_ID)).toEqual([DEMO_LIKED_RECIPE]);
  });

  it("keeps liked lists isolated per user", () => {
    addLikedRecipe(USER_ID, RECIPE_A);
    addLikedRecipe("another-user", RECIPE_B);

    expect(getLikedRecipes(USER_ID)).toEqual([RECIPE_A, DEMO_LIKED_RECIPE]);
    expect(getLikedRecipes("another-user")).toEqual([RECIPE_B]);
  });

  it("clears only user-added liked recipes for the selected user", () => {
    addLikedRecipe(USER_ID, RECIPE_A);
    addLikedRecipe("another-user", RECIPE_B);

    expect(clearLikedRecipes(USER_ID)).toBe(true);
    expect(getLikedRecipes(USER_ID)).toEqual([DEMO_LIKED_RECIPE]);
    expect(getLikedRecipes("another-user")).toEqual([RECIPE_B]);
  });

  it("removes corrupt JSON and safely returns the pinned demo recipe", () => {
    const key = "recipe-match:liked:v1:demo-user-1";
    window.sessionStorage.setItem(key, "{not json");

    expect(getLikedRecipes(USER_ID)).toEqual([DEMO_LIKED_RECIPE]);
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it("uses the runtime snapshot when persisted JSON becomes corrupt", () => {
    const key = "recipe-match:liked:v1:demo-user-1";
    addLikedRecipe(USER_ID, RECIPE_A);
    window.sessionStorage.setItem(key, "{not json");

    expect(getLikedRecipes(USER_ID)).toEqual([RECIPE_A, DEMO_LIKED_RECIPE]);
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it("writes, reads, and clears the memory fallback when storage methods throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(addLikedRecipe(USER_ID, RECIPE_A)).toBe(false);
    expect(getLikedRecipes(USER_ID)).toEqual([RECIPE_A, DEMO_LIKED_RECIPE]);
    expect(clearLikedRecipes(USER_ID)).toBe(false);

    vi.restoreAllMocks();
    expect(getLikedRecipes(USER_ID)).toEqual([DEMO_LIKED_RECIPE]);
  });

  it("rejects a missing user id for clear", () => {
    expect(clearLikedRecipes(" ")).toBe(false);
  });
});
