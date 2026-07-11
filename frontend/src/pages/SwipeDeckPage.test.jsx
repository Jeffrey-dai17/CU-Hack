import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SwipeDeckPage from "./SwipeDeckPage.jsx";

const apiMocks = vi.hoisted(() => ({
  getCurrentGoal: vi.fn(),
  getRecipes: vi.fn(),
  logSwipe: vi.fn(),
}));

const motionMocks = vi.hoisted(() => ({
  animate: vi.fn(),
  prefersReducedMotion: vi.fn(() => false),
}));

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("../api/client.js", () => ({
  getApiErrorMessage(error, fallback) {
    const message = error?.response?.data?.error;
    return typeof message === "string" && message.trim() ? message.trim() : fallback;
  },
  getCurrentGoal: apiMocks.getCurrentGoal,
  getRecipes: apiMocks.getRecipes,
  logSwipe: apiMocks.logSwipe,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
  };
});

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal();
  const React = await import("react");

  const MockArticle = React.forwardRef(function MockArticle(props, ref) {
    return React.createElement(
      "article",
      {
        ref,
        className: props.className,
        "aria-labelledby": props["aria-labelledby"],
        onDragEnd: props.onDragEnd,
      },
      props.children,
    );
  });

  function useMotionValue(initialValue) {
    const valueRef = React.useRef(initialValue);
    const motionValueRef = React.useRef(null);

    if (!motionValueRef.current) {
      motionValueRef.current = {
        get: () => valueRef.current,
        set: (nextValue) => {
          valueRef.current = nextValue;
        },
      };
    }

    return motionValueRef.current;
  }

  return {
    ...actual,
    animate: motionMocks.animate,
    motion: { article: MockArticle },
    useMotionValue,
    useReducedMotion: motionMocks.prefersReducedMotion,
    useTransform: (value) => value,
  };
});

const FIRST_RECIPE = {
  id: "alpha/42",
  title: "Lemon Chicken Bowl",
  image: "https://images.example/alpha.jpg",
  readyInMinutes: 25,
  servings: 2,
  calories: 480,
  macros: { protein_g: 38, carbs_g: 42, fat_g: 14 },
};

const SECOND_RECIPE = {
  id: 9002,
  title: "Ginger Tofu Plate",
  image: "https://images.example/beta.jpg",
  readyInMinutes: 20,
  servings: 1,
  calories: 510,
  macros: { protein_g: 31, carbs_g: 55, fat_g: 18 },
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function renderDeck() {
  return render(
    <MemoryRouter initialEntries={["/deck"]}>
      <SwipeDeckPage />
    </MemoryRouter>,
  );
}

async function renderLoadedDeck(recipes = [FIRST_RECIPE, SECOND_RECIPE]) {
  apiMocks.getRecipes.mockResolvedValue({ recipes });
  const result = renderDeck();
  const progress = await screen.findByRole("status");
  expect(progress).toHaveTextContent(`1 of ${recipes.length}: ${recipes[0].title}`);
  return result;
}

describe("SwipeDeckPage", () => {
  beforeEach(() => {
    apiMocks.getCurrentGoal.mockResolvedValue({
      userId: "demo-user-1",
      rawText: "high protein",
      parsedFilter: { minProtein: 30 },
    });
    apiMocks.getRecipes.mockResolvedValue({ recipes: [FIRST_RECIPE, SECOND_RECIPE] });
    apiMocks.logSwipe.mockResolvedValue({ ok: true });
    motionMocks.animate.mockResolvedValue(undefined);
    motionMocks.prefersReducedMotion.mockReturnValue(false);
  });

  it("redirects direct deck access when no saved goal exists", async () => {
    apiMocks.getCurrentGoal.mockResolvedValue(null);

    renderDeck();

    expect(screen.getByRole("heading", { name: "Building your deck" })).toBeInTheDocument();
    await waitFor(() => {
      expect(routerMocks.navigate).toHaveBeenCalledWith("/", { replace: true });
    });
    expect(apiMocks.getRecipes).not.toHaveBeenCalled();
  });

  it("shows load errors, retries the complete guard and deck request, and filters unusable recipes", async () => {
    const user = userEvent.setup();
    apiMocks.getCurrentGoal
      .mockRejectedValueOnce({ response: { data: { error: "Recipe service is warming up." } } })
      .mockResolvedValueOnce({ rawText: "quick meals" });
    apiMocks.getRecipes.mockResolvedValue({
      recipes: [null, {}, { id: "   ", title: "Invalid" }, FIRST_RECIPE],
    });

    renderDeck();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Recipe service is warming up.");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "1 of 1: Lemon Chicken Bowl",
    );
    expect(apiMocks.getCurrentGoal).toHaveBeenCalledTimes(2);
    expect(apiMocks.getRecipes).toHaveBeenCalledTimes(1);
  });

  it("renders a no-match state without inventing cards", async () => {
    apiMocks.getRecipes.mockResolvedValue({ recipes: [] });

    renderDeck();

    expect(await screen.findByRole("heading", { name: "Try a different goal" })).toBeVisible();
    expect(screen.getByText(/No recipes matched this goal yet/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "View recipe" })).not.toBeInTheDocument();
  });

  it("advances to the end state after the last recipe is skipped", async () => {
    const user = userEvent.setup();
    await renderLoadedDeck([FIRST_RECIPE]);

    await user.click(screen.getByRole("button", { name: "Skip recipe" }));

    expect(
      await screen.findByRole("heading", { name: "You have seen all the matches" }),
    ).toBeVisible();
    expect(apiMocks.logSwipe).toHaveBeenCalledWith(
      "demo-user-1",
      "alpha/42",
      "left",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("logs the exact active recipe on a left swipe and announces the next card", async () => {
    const user = userEvent.setup();
    await renderLoadedDeck();

    expect(screen.getByRole("status")).toHaveTextContent("1 of 2: Lemon Chicken Bowl");
    await user.click(screen.getByRole("button", { name: "Skip recipe" }));

    await waitFor(() => {
      expect(apiMocks.logSwipe).toHaveBeenCalledWith(
        "demo-user-1",
        "alpha/42",
        "left",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("2 of 2: Ginger Tofu Plate");
    expect(screen.getByRole("heading", { name: "Ginger Tofu Plate" })).toBeVisible();
  });

  it("waits for a successful right-swipe log before navigating to the exact encoded recipe", async () => {
    const user = userEvent.setup();
    const swipeResponse = deferred();
    apiMocks.logSwipe.mockReturnValue(swipeResponse.promise);
    await renderLoadedDeck();

    await user.click(screen.getByRole("button", { name: "View recipe" }));

    await waitFor(() => expect(apiMocks.logSwipe).toHaveBeenCalledTimes(1));
    expect(apiMocks.logSwipe).toHaveBeenCalledWith(
      "demo-user-1",
      "alpha/42",
      "right",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(routerMocks.navigate).not.toHaveBeenCalled();

    await act(async () => swipeResponse.resolve({ ok: true }));
    await waitFor(() => {
      expect(routerMocks.navigate).toHaveBeenCalledWith("/recipe/alpha%2F42");
    });
  });

  it("keeps actions locked through a failed swipe's return animation and supports a clean retry", async () => {
    const user = userEvent.setup();
    const returnAnimation = deferred();
    motionMocks.animate
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(returnAnimation.promise);
    apiMocks.logSwipe
      .mockRejectedValueOnce({ response: { data: { error: "Swipe could not be saved." } } })
      .mockResolvedValueOnce({ ok: true });
    await renderLoadedDeck();

    await user.click(screen.getByRole("button", { name: "View recipe" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Swipe could not be saved.");
    expect(screen.getByRole("button", { name: "Skip recipe" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "View recipe" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Change goal" })).toBeDisabled();

    await act(async () => returnAnimation.resolve());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "View recipe" })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "View recipe" }));
    await waitFor(() => {
      expect(routerMocks.navigate).toHaveBeenCalledWith("/recipe/alpha%2F42");
    });
    expect(apiMocks.logSwipe).toHaveBeenCalledTimes(2);
  });

  it("aborts a pending right swipe and never navigates after unmount", async () => {
    const user = userEvent.setup();
    const swipeResponse = deferred();
    apiMocks.logSwipe.mockReturnValue(swipeResponse.promise);
    const { unmount } = await renderLoadedDeck();

    await user.click(screen.getByRole("button", { name: "View recipe" }));
    await waitFor(() => expect(apiMocks.logSwipe).toHaveBeenCalledTimes(1));
    const requestConfig = apiMocks.logSwipe.mock.calls[0][3];

    unmount();
    expect(requestConfig.signal.aborted).toBe(true);
    await act(async () => swipeResponse.resolve({ ok: true }));
    expect(routerMocks.navigate).not.toHaveBeenCalled();
  });

  it("replaces a broken remote card image with an accessible fallback", async () => {
    await renderLoadedDeck([FIRST_RECIPE]);
    const image = screen.getByRole("img", { name: "Lemon Chicken Bowl" });

    fireEvent.error(image);

    expect(
      screen.getByRole("img", { name: "Lemon Chicken Bowl image unavailable" }),
    ).toHaveTextContent("Recipe image unavailable");
    expect(screen.queryByAltText("Lemon Chicken Bowl")).not.toBeInTheDocument();
  });

  it("labels nutrition per serving, pluralizes one serving, and rejects non-finite readings", async () => {
    const malformedNutritionRecipe = {
      ...FIRST_RECIPE,
      readyInMinutes: Number.POSITIVE_INFINITY,
      servings: 1,
      calories: Number.POSITIVE_INFINITY,
      macros: {
        protein_g: -4,
        carbs_g: Number.NaN,
        fat_g: 0,
      },
    };
    await renderLoadedDeck([malformedNutritionRecipe]);

    const nutrition = screen.getByLabelText("Nutrition per serving");
    expect(within(nutrition).getByText("Calories N/A")).toBeVisible();
    expect(within(nutrition).getByText("N/A protein")).toBeVisible();
    expect(within(nutrition).getByText("N/A carbs / 0g fat")).toBeVisible();
    expect(within(nutrition).getByText("Per serving")).toBeVisible();
    expect(screen.getByText(/Time N\/A/)).toHaveTextContent("1 serving");
    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
  });

  it("announces a background left-swipe failure without blocking the next recipe", async () => {
    const user = userEvent.setup();
    apiMocks.logSwipe.mockRejectedValueOnce({
      response: { data: { error: "Skip history was not saved." } },
    });
    await renderLoadedDeck();

    await user.click(screen.getByRole("button", { name: "Skip recipe" }));

    expect(await screen.findByRole("status")).toHaveTextContent("2 of 2: Ginger Tofu Plate");
    expect(await screen.findByRole("alert")).toHaveTextContent("Skip history was not saved.");
    expect(screen.getByRole("button", { name: "View recipe" })).toBeEnabled();
  });
});
