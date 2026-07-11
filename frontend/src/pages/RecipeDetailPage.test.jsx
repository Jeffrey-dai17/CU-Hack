import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRecipeById } from "../api/client.js";
import RecipeDetailPage from "./RecipeDetailPage.jsx";

vi.mock("../api/client.js", () => ({
  getRecipeById: vi.fn(),
}));

const COMPLETE_RECIPE = {
  id: "recipe-1",
  title: "Grilled Chicken & Quinoa Bowl",
  image: "https://images.example.test/chicken-bowl.jpg",
  readyInMinutes: 25,
  servings: 2,
  calories: 480.4,
  macros: {
    protein_g: 38.2,
    carbs_g: 42.1,
    fat_g: 14.4,
  },
  diets: ["gluten free", "dairy free"],
  sourceUrl: "https://recipes.example.test/chicken-bowl",
};

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function RecipeRouteHarness() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate("/recipe/second-recipe")}>
        Open second recipe
      </button>
      <RecipeDetailPage />
    </>
  );
}

function renderRecipeDetail(path = "/recipe/recipe-1", { withNavigation = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/recipe/:id"
          element={withNavigation ? <RecipeRouteHarness /> : <RecipeDetailPage />}
        />
        <Route path="/recipe" element={<RecipeDetailPage />} />
        <Route path="/deck" element={<h1>Recipe deck destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function renderLoadedRecipe(recipe = COMPLETE_RECIPE) {
  getRecipeById.mockResolvedValue(recipe);
  const view = renderRecipeDetail();
  await screen.findByRole("heading", { name: recipe.title || "Untitled recipe", level: 1 });
  return view;
}

describe("RecipeDetailPage", () => {
  beforeEach(() => {
    getRecipeById.mockReset();
    document.title = "Recipe Match";
  });

  it("fetches the route id with an abort signal and renders the returned recipe", async () => {
    getRecipeById.mockResolvedValue(COMPLETE_RECIPE);

    renderRecipeDetail("/recipe/api-id-42");

    expect(screen.getByRole("status")).toHaveTextContent("Loading your recipe");
    expect(
      await screen.findByRole("heading", {
        name: "Grilled Chicken & Quinoa Bowl",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(getRecipeById).toHaveBeenCalledTimes(1);
    expect(getRecipeById).toHaveBeenCalledWith(
      "api-id-42",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(getRecipeById.mock.calls[0][1].signal.aborted).toBe(false);
  });

  it("does not fetch an incomplete recipe link and focuses its error heading", async () => {
    renderRecipeDetail("/recipe");

    const heading = await screen.findByRole("heading", { name: "Couldn't load this recipe" });
    expect(screen.getByRole("alert")).toHaveTextContent("This recipe link is incomplete.");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(getRecipeById).not.toHaveBeenCalled();
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("aborts the old request on an id change and ignores its stale result", async () => {
    const user = userEvent.setup();
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    getRecipeById
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    renderRecipeDetail("/recipe/first-recipe", { withNavigation: true });
    await waitFor(() => expect(getRecipeById).toHaveBeenCalledTimes(1));
    const firstSignal = getRecipeById.mock.calls[0][1].signal;

    await user.click(screen.getByRole("button", { name: "Open second recipe" }));
    await waitFor(() => expect(getRecipeById).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    expect(getRecipeById.mock.calls[1][0]).toBe("second-recipe");

    secondRequest.resolve({ ...COMPLETE_RECIPE, id: "second-recipe", title: "Second recipe" });
    expect(
      await screen.findByRole("heading", { name: "Second recipe", level: 1 }),
    ).toBeInTheDocument();

    await act(async () => {
      firstRequest.resolve({ ...COMPLETE_RECIPE, id: "first-recipe", title: "Stale recipe" });
      await firstRequest.promise;
    });
    expect(screen.queryByRole("heading", { name: "Stale recipe" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Second recipe" })).toBeInTheDocument();
  });

  it("shows a request error, focuses it, and retries the same id successfully", async () => {
    const user = userEvent.setup();
    const retryRequest = createDeferred();
    getRecipeById
      .mockRejectedValueOnce({
        response: { data: { error: "  Recipe   provider is warming up.  " } },
      })
      .mockReturnValueOnce(retryRequest.promise);

    renderRecipeDetail("/recipe/retry-me");
    const errorHeading = await screen.findByRole("heading", {
      name: "Couldn't load this recipe",
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Recipe provider is warming up.");
    await waitFor(() => expect(errorHeading).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading your recipe");
    retryRequest.resolve(COMPLETE_RECIPE);
    expect(
      await screen.findByRole("heading", {
        name: "Grilled Chicken & Quinoa Bowl",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(getRecipeById).toHaveBeenCalledTimes(2);
    expect(getRecipeById.mock.calls.map(([id]) => id)).toEqual(["retry-me", "retry-me"]);
  });

  it.each([null, [], {}, "not a recipe"]) (
    "treats a malformed response as an unavailable recipe: %j",
    async (response) => {
      getRecipeById.mockResolvedValue(response);
      renderRecipeDetail();

      expect(
        await screen.findByRole("heading", { name: "Couldn't load this recipe" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The recipe service returned incomplete details. Please try again.",
      );
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    },
  );

  it("renders missing optional fields honestly with semantic N/A nutrition", async () => {
    await renderLoadedRecipe({ id: "minimal-recipe" });

    expect(screen.getByRole("heading", { name: "Untitled recipe", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Untitled recipe image unavailable" })).toHaveTextContent(
      "Recipe image unavailable",
    );
    expect(screen.getAllByText("N/A")).toHaveLength(4);
    expect(screen.queryByText(/\b(?:kcal|g)\b/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Recipe diets")).not.toBeInTheDocument();
    expect(screen.getByText("Recipe instructions unavailable.")).toBeInTheDocument();
  });

  it("labels nutrition per serving and keeps every dt before its dd", async () => {
    await renderLoadedRecipe();

    const nutrition = screen.getByRole("region", {
      name: "The numbers behind your match",
    });
    expect(within(nutrition).getByText("Nutrition per serving")).toBeInTheDocument();

    const readings = [
      ["Calories", "480", "kcal"],
      ["Protein", "38", "g"],
      ["Carbs", "42", "g"],
      ["Fat", "14", "g"],
    ];

    for (const [label, value, unit] of readings) {
      const term = within(nutrition).getByText(label);
      const description = term.nextElementSibling;
      expect(term.tagName).toBe("DT");
      expect(description?.tagName).toBe("DD");
      expect(within(description).getByText(value)).toBeInTheDocument();
      expect(within(description).getByText(unit)).toBeInTheDocument();
    }
  });

  it.each([
    [1, "1 serving"],
    [2, "2 servings"],
  ])("pluralizes metadata for %i serving(s)", async (servings, expected) => {
    await renderLoadedRecipe({
      ...COMPLETE_RECIPE,
      readyInMinutes: undefined,
      servings,
    });

    expect(screen.getByText(expected)).toHaveClass("recipe-detail-metadata");
  });

  it("normalizes and deduplicates diet labels, including low FODMAP", async () => {
    await renderLoadedRecipe({
      ...COMPLETE_RECIPE,
      diets: [" low FODMAP ", "VEGAN", "vegan", "", null, "Dairy FREE"],
    });

    const list = screen.getByLabelText("Recipe diets");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Low FODMAP")).toBeInTheDocument();
    expect(within(list).getByText("Vegan")).toBeInTheDocument();
    expect(within(list).getByText("Dairy Free")).toBeInTheDocument();
  });

  it("renders only credential-free HTTP(S) instruction URLs as external links", async () => {
    await renderLoadedRecipe();

    const sourceLink = screen.getByRole("link", {
      name: /View full recipe instructions/,
    });
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://recipes.example.test/chicken-bowl",
    );
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(sourceLink).toHaveAccessibleName(
      "View full recipe instructions. Opens in a new tab.",
    );
  });

  it.each([
    "javascript:alert(document.cookie)",
    "data:text/html,unsafe",
    "https://user:password@recipes.example.test/private",
    "//recipes.example.test/relative",
  ])("rejects an unsafe instruction URL: %s", async (sourceUrl) => {
    await renderLoadedRecipe({ ...COMPLETE_RECIPE, sourceUrl });

    expect(screen.getByText("Recipe instructions unavailable.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View full recipe instructions/ }),
    ).not.toBeInTheDocument();
  });

  it("uses safe image URLs and replaces a failed image with an accessible fallback", async () => {
    await renderLoadedRecipe();

    const image = screen.getByRole("img", { name: "Grilled Chicken & Quinoa Bowl" });
    expect(image).toHaveAttribute("src", "https://images.example.test/chicken-bowl.jpg");
    expect(image).toHaveAttribute("decoding", "async");
    fireEvent.error(image);

    expect(
      screen.getByRole("img", {
        name: "Grilled Chicken & Quinoa Bowl image unavailable",
      }),
    ).toHaveTextContent("Recipe image unavailable");
  });

  it("rejects an unsafe image URL before it reaches an img element", async () => {
    await renderLoadedRecipe({
      ...COMPLETE_RECIPE,
      image: "https://user:password@images.example.test/private.jpg",
    });

    expect(
      screen.getByRole("img", {
        name: "Grilled Chicken & Quinoa Bowl image unavailable",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByAltText("Grilled Chicken & Quinoa Bowl")).not.toBeInTheDocument();
  });

  it("sets a recipe-specific document title and focuses the loaded heading", async () => {
    await renderLoadedRecipe();

    const heading = screen.getByRole("heading", {
      name: "Grilled Chicken & Quinoa Bowl",
      level: 1,
    });
    expect(document.title).toBe("Grilled Chicken & Quinoa Bowl | Recipe Match");
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("falls back safely for invalid nutrition and metadata values", async () => {
    await renderLoadedRecipe({
      ...COMPLETE_RECIPE,
      calories: Number.NaN,
      readyInMinutes: -4,
      servings: 0,
      macros: {
        protein_g: Number.POSITIVE_INFINITY,
        carbs_g: -1,
        fat_g: "14",
      },
    });

    expect(screen.getAllByText("N/A")).toHaveLength(4);
    expect(document.querySelector(".recipe-detail-metadata")).not.toBeInTheDocument();
  });
});
