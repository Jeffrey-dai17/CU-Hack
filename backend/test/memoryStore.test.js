const assert = require("node:assert/strict");
const test = require("node:test");

const { addSwipe, getGoal, getSwipes, setGoal } = require("../src/store/memoryStore");

test("memory store saves and replaces one current goal per user", () => {
  const userId = `user-${Date.now()}-goal`;

  setGoal(userId, "high protein", { minProtein_g: 30 });
  const firstGoal = getGoal(userId);

  assert.equal(firstGoal.rawText, "high protein");
  assert.deepEqual(firstGoal.parsedFilter, { minProtein_g: 30 });
  assert.match(firstGoal.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  setGoal(userId, "vegan", { diet: "vegan" });

  assert.deepEqual(getGoal(userId), {
    rawText: "vegan",
    parsedFilter: { diet: "vegan" },
    updatedAt: getGoal(userId).updatedAt,
  });
});

test("memory store returns null for missing goals", () => {
  assert.equal(getGoal(`missing-${Date.now()}`), null);
});

test("memory store records swipes and filters by user", () => {
  const userId = `user-${Date.now()}-swipes`;

  addSwipe(userId, "recipe-1", "right");
  addSwipe("someone-else", "recipe-2", "left");
  addSwipe(userId, "recipe-3", "left");

  const swipes = getSwipes(userId);

  assert.equal(swipes.length, 2);
  assert.deepEqual(
    swipes.map(({ userId: swipeUserId, recipeId, direction }) => ({
      userId: swipeUserId,
      recipeId,
      direction,
    })),
    [
      { userId, recipeId: "recipe-1", direction: "right" },
      { userId, recipeId: "recipe-3", direction: "left" },
    ]
  );
  assert.match(swipes[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
