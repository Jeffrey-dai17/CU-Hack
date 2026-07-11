const express = require("express");

const { parseGoal } = require("../services/geminiService");
const { getGoal, setGoal } = require("../store/memoryStore");

const router = express.Router();

function isMissingString(value) {
  return typeof value !== "string" || value.trim() === "";
}

function normalizeParsedFilter(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

router.post("/parse-goal", async (req, res) => {
  try {
    const text = req.body?.text;

    if (isMissingString(text)) {
      return res.status(400).json({ error: "text is required" });
    }

    const parsedFilter = await parseGoal(text);
    return res.json({ parsedFilter });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected server error" });
  }
});

router.post("/goal", (req, res) => {
  try {
    const { userId, rawText } = req.body || {};

    if (isMissingString(userId) || isMissingString(rawText)) {
      return res.status(400).json({ error: "userId and rawText are required" });
    }

    setGoal(userId.trim(), rawText.trim(), normalizeParsedFilter(req.body?.parsedFilter));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected server error" });
  }
});

router.get("/goal/current", (req, res) => {
  try {
    const userId = typeof req.query?.userId === "string" ? req.query.userId.trim() : "";
    return res.json(userId ? getGoal(userId) : null);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unexpected server error" });
  }
});

module.exports = router;
