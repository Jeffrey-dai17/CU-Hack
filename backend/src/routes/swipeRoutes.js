const express = require("express");

const { addSwipe } = require("../store/memoryStore");

const router = express.Router();

function isMissingString(value) {
  return typeof value !== "string" || value.trim() === "";
}

router.post("/swipe", (req, res) => {
  try {
    const { userId, recipeId, direction } = req.body || {};

    if (isMissingString(userId) || isMissingString(recipeId)) {
      return res.status(400).json({ error: "userId and recipeId are required" });
    }

    if (direction !== "left" && direction !== "right") {
      return res.status(400).json({ error: "direction must be left or right" });
    }

    addSwipe(userId.trim(), recipeId.trim(), direction);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected server error" });
  }
});

module.exports = router;
