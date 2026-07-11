import axios from "axios";

const client = axios.create({ baseURL: "http://localhost:4000/api" });

export async function parseGoal(text) {
  const response = await client.post("/parse-goal", { text });
  return response.data;
}

export async function saveGoal(userId, rawText, parsedFilter) {
  const response = await client.post("/goal", { userId, rawText, parsedFilter });
  return response.data;
}

export async function getCurrentGoal(userId) {
  const response = await client.get(`/goal/current?userId=${userId}`);
  return response.data;
}

export async function getRecipes(userId) {
  const response = await client.get(`/recipes?userId=${userId}`);
  return response.data;
}

export async function getRecipeById(id) {
  const response = await client.get(`/recipes/${id}`);
  return response.data;
}

export async function logSwipe(userId, recipeId, direction) {
  const response = await client.post("/swipe", { userId, recipeId, direction });
  return response.data;
}
