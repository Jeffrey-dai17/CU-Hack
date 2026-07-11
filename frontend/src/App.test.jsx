import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

vi.mock("./components/RouteEffects.jsx", () => ({
  default: () => null,
}));

vi.mock("./pages/GoalEntryPage.jsx", () => ({
  default: () => <h1>Goal route</h1>,
}));

vi.mock("./pages/SwipeDeckPage.jsx", () => ({
  default: () => <h1>Deck route</h1>,
}));

vi.mock("./pages/RecipeDetailPage.jsx", () => ({
  default: () => <h1>Recipe route</h1>,
}));

vi.mock("./pages/LikedRecipesPage.jsx", () => ({
  default: () => <h1>Liked route</h1>,
}));

vi.mock("./pages/NotFoundPage.jsx", () => ({
  default: () => <h1>Not found route</h1>,
}));

describe("App routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it.each([
    ["/", "Goal route"],
    ["/deck", "Deck route"],
    ["/liked", "Liked route"],
    ["/recipe/12345", "Recipe route"],
    ["/missing/path", "Not found route"],
  ])("renders the correct page for %s", (path, heading) => {
    window.history.replaceState({}, "", path);

    render(<App />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });
});
