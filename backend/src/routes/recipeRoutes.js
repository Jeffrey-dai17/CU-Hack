const express = require("express");

const { getRecipeById, searchRecipes } = require("../services/spoonacularService");
const { getGoal } = require("../store/memoryStore");

const router = express.Router();

router.get("/recipes", async (req, res) => {
  try {
    const userId = typeof req.query?.userId === "string" ? req.query.userId.trim() : "";
    const goal = userId ? getGoal(userId) : null;
    const recipes = await searchRecipes(goal?.parsedFilter || {});

    return res.json({ recipes });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected server error" });
  }
});

router.get("/recipes/:id", async (req, res) => {
  try {
    const recipe = await getRecipeById(req.params.id);
    return res.json(recipe);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected server error" });
  }
});

module.exports = router;
