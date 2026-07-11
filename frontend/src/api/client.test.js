import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import {
  getCurrentGoal,
  getApiErrorMessage,
  getRecipeById,
  getRecipes,
  logSwipe,
  parseGoal,
  saveGoal,
} from "./client.js";
import { server } from "../test/server.js";

const API_URL = "http://localhost:3000/api";
const requestConfig = {
  headers: { "X-Request-Id": "frontend-test" },
};

describe("API client", () => {
  it.each([
    [{ response: { data: { error: "  Provider   timed out  " } } }, "Fallback", "Provider timed out"],
    [{ response: { data: { error: "" } } }, "Fallback", "Fallback"],
    [{ response: { data: { error: 42 } } }, "Fallback", "Fallback"],
    [{ response: { data: { error: "x".repeat(201) } } }, "Fallback", "Fallback"],
    [new Error("network failed"), "Fallback", "Fallback"],
  ])("normalizes bounded API errors and otherwise returns the fallback", (error, fallback, expected) => {
    expect(getApiErrorMessage(error, fallback)).toBe(expected);
  });

  it("posts goal text to the parser and forwards request config", async () => {
    let requestDetails;

    server.use(
      http.post(`${API_URL}/parse-goal`, async ({ request }) => {
        const url = new URL(request.url);
        requestDetails = {
          body: await request.json(),
          header: request.headers.get("x-request-id"),
          origin: url.origin,
          pathname: url.pathname,
        };

        return HttpResponse.json({ diet: "vegan", maxReadyTime: 30 });
      }),
    );

    await expect(
      parseGoal("vegan and quick", requestConfig),
    ).resolves.toEqual({ diet: "vegan", maxReadyTime: 30 });
    expect(requestDetails).toEqual({
      body: { text: "vegan and quick" },
      header: "frontend-test",
      origin: "http://localhost:3000",
      pathname: "/api/parse-goal",
    });
  });

  it("posts the complete saved-goal body and returns response data", async () => {
    let requestDetails;
    const parsedFilter = {
      diet: "vegan",
      excludeIngredients: ["peanuts"],
      maxReadyTime: 20,
    };

    server.use(
      http.post(`${API_URL}/goal`, async ({ request }) => {
        requestDetails = {
          body: await request.json(),
          header: request.headers.get("x-request-id"),
        };

        return HttpResponse.json({ id: "goal-1", saved: true });
      }),
    );

    await expect(
      saveGoal(
        "demo-user-1",
        "vegan, no peanuts, under 20 minutes",
        parsedFilter,
        requestConfig,
      ),
    ).resolves.toEqual({ id: "goal-1", saved: true });
    expect(requestDetails).toEqual({
      body: {
        userId: "demo-user-1",
        rawText: "vegan, no peanuts, under 20 minutes",
        parsedFilter,
      },
      header: "frontend-test",
    });
  });

  it("gets the current goal with encoded, merged query parameters", async () => {
    let requestDetails;

    server.use(
      http.get(`${API_URL}/goal/current`, ({ request }) => {
        const url = new URL(request.url);
        requestDetails = {
          header: request.headers.get("x-request-id"),
          include: url.searchParams.get("include"),
          userId: url.searchParams.get("userId"),
        };

        return HttpResponse.json({ rawText: "high protein" });
      }),
    );

    await expect(
      getCurrentGoal("demo user/1", {
        ...requestConfig,
        params: { include: "parsed filter", userId: "stale-user" },
      }),
    ).resolves.toEqual({ rawText: "high protein" });
    expect(requestDetails).toEqual({
      header: "frontend-test",
      include: "parsed filter",
      userId: "demo user/1",
    });
  });

  it("gets recipes with the user id while preserving caller query config", async () => {
    let requestDetails;
    const response = { recipes: [{ id: "recipe-1" }] };

    server.use(
      http.get(`${API_URL}/recipes`, ({ request }) => {
        const url = new URL(request.url);
        requestDetails = {
          header: request.headers.get("x-request-id"),
          page: url.searchParams.get("page"),
          userId: url.searchParams.get("userId"),
        };

        return HttpResponse.json(response);
      }),
    );

    await expect(
      getRecipes("demo-user-1", {
        ...requestConfig,
        params: { page: 2 },
      }),
    ).resolves.toEqual(response);
    expect(requestDetails).toEqual({
      header: "frontend-test",
      page: "2",
      userId: "demo-user-1",
    });
  });

  it("encodes a recipe id and forwards config to the detail request", async () => {
    let requestDetails;
    const recipe = { id: "meal/42 ?", title: "Test bowl" };

    server.use(
      http.get(`${API_URL}/recipes/*`, ({ request }) => {
        const url = new URL(request.url);
        requestDetails = {
          header: request.headers.get("x-request-id"),
          pathname: url.pathname,
          source: url.searchParams.get("source"),
        };

        return HttpResponse.json(recipe);
      }),
    );

    await expect(
      getRecipeById("meal/42 ?", {
        ...requestConfig,
        params: { source: "deck" },
      }),
    ).resolves.toEqual(recipe);
    expect(requestDetails).toEqual({
      header: "frontend-test",
      pathname: "/api/recipes/meal%2F42%20%3F",
      source: "deck",
    });
  });

  it("posts all swipe fields and forwards request config", async () => {
    let requestDetails;

    server.use(
      http.post(`${API_URL}/swipe`, async ({ request }) => {
        requestDetails = {
          body: await request.json(),
          header: request.headers.get("x-request-id"),
        };

        return HttpResponse.json({ logged: true });
      }),
    );

    await expect(
      logSwipe("demo-user-1", "recipe-9", "right", requestConfig),
    ).resolves.toEqual({ logged: true });
    expect(requestDetails).toEqual({
      body: {
        userId: "demo-user-1",
        recipeId: "recipe-9",
        direction: "right",
      },
      header: "frontend-test",
    });
  });

  it.each([
    [
      "parseGoal",
      http.post(`${API_URL}/parse-goal`, () =>
        HttpResponse.json({ error: "parse failed" }, { status: 422 }),
      ),
      () => parseGoal("anything"),
      "parse failed",
    ],
    [
      "saveGoal",
      http.post(`${API_URL}/goal`, () =>
        HttpResponse.json({ error: "save failed" }, { status: 422 }),
      ),
      () => saveGoal("user", "anything", {}),
      "save failed",
    ],
    [
      "getCurrentGoal",
      http.get(`${API_URL}/goal/current`, () =>
        HttpResponse.json({ error: "goal failed" }, { status: 422 }),
      ),
      () => getCurrentGoal("user"),
      "goal failed",
    ],
    [
      "getRecipes",
      http.get(`${API_URL}/recipes`, () =>
        HttpResponse.json({ error: "recipes failed" }, { status: 422 }),
      ),
      () => getRecipes("user"),
      "recipes failed",
    ],
    [
      "getRecipeById",
      http.get(`${API_URL}/recipes/error-id`, () =>
        HttpResponse.json({ error: "detail failed" }, { status: 422 }),
      ),
      () => getRecipeById("error-id"),
      "detail failed",
    ],
    [
      "logSwipe",
      http.post(`${API_URL}/swipe`, () =>
        HttpResponse.json({ error: "swipe failed" }, { status: 422 }),
      ),
      () => logSwipe("user", "recipe", "left"),
      "swipe failed",
    ],
  ])("propagates %s failures with the backend response intact", async (
    _name,
    handler,
    makeRequest,
    message,
  ) => {
    server.use(handler);

    await expect(makeRequest()).rejects.toMatchObject({
      response: {
        data: { error: message },
        status: 422,
      },
    });
  });
});
