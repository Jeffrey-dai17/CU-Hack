const goals = new Map();
const swipes = [];

function setGoal(userId, rawText, parsedFilter) {
  goals.set(userId, {
    rawText,
    parsedFilter,
    updatedAt: new Date().toISOString(),
  });
}

function getGoal(userId) {
  return goals.get(userId) || null;
}

function addSwipe(userId, recipeId, direction) {
  swipes.push({
    userId,
    recipeId,
    direction,
    timestamp: new Date().toISOString(),
  });
}

function getSwipes(userId) {
  return swipes.filter((swipe) => swipe.userId === userId);
}

module.exports = { setGoal, getGoal, addSwipe, getSwipes };
