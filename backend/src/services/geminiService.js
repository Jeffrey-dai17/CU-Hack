const { GoogleGenerativeAI } = require("@google/generative-ai");

function buildPrompt(rawText) {
  const input = String(rawText ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  return [
    "You are a parser that converts a food-related goal sentence into a JSON object matching this exact schema.",
    "Output raw JSON only. Do not include markdown code fences, explanation, preamble, or any text outside the JSON object. The response must start with {.",
    "Every field is optional. Omit fields the input text does not clearly imply.",
    "Schema:",
    "{",
    '  "maxCalories": number,',
    '  "minProtein_g": number,',
    '  "diet": string,',
    '  "maxReadyTime": number,',
    '  "excludeIngredients": array of strings',
    "}",
    'The diet field must be exactly one of: "gluten free", "ketogenic", "vegetarian", "lacto-vegetarian", "ovo-vegetarian", "vegan", "pescetarian", "paleo", "primal", "low fodmap", "whole30". Map user intent to the closest one of these. Omit diet entirely if nothing fits.',
    "maxReadyTime is measured in minutes.",
    "",
    'Input: "cutting carbs, high protein, something quick"',
    'Output: {"minProtein_g": 30, "maxReadyTime": 30}',
    "",
    'Input: "vegan, no peanuts, under 600 calories"',
    'Output: {"diet": "vegan", "excludeIngredients": ["peanuts"], "maxCalories": 600}',
    "",
    'Input: "just something tasty"',
    "Output: {}",
    "",
    'Input: "keto, dinner in under an hour"',
    'Output: {"diet": "ketogenic", "maxReadyTime": 60}',
    "",
    `Input: "${input}"`,
    "Output:",
  ].join("\n");
}

function stripMarkdownFences(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function parseGoal(rawText) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return {};
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(buildPrompt(rawText));
    const responseText = result.response.text();
    const cleanedText = stripMarkdownFences(responseText);

    try {
      const parsed = JSON.parse(cleanedText);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      console.error("Failed to parse Gemini response:", responseText);
      return {};
    }
  } catch (error) {
    console.error("Gemini goal parsing failed:", error.message);
    return {};
  }
}

module.exports = { parseGoal, parseGoalWithGemini: parseGoal };
