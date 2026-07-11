import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseGoal, saveGoal } from "../api/client.js";
import { USER_ID } from "../constants.js";
import {
  clearDeckSessions,
  readDeckSession,
  writeDeckSession,
} from "../utils/deckSession.js";
import GoalEntryPage from "./GoalEntryPage.jsx";

vi.mock("../api/client.js", () => ({
  parseGoal: vi.fn(),
  saveGoal: vi.fn(),
}));

const CACHED_RECIPE = {
  id: "12345",
  title: "Old match",
  image: "https://images.example/old-match.jpg",
  readyInMinutes: 25,
  servings: 2,
  calories: 480,
  macros: { protein_g: 38, carbs_g: 42, fat_g: 14 },
  diets: ["vegan"],
  sourceUrl: "https://recipes.example/old-match",
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

function renderGoalEntry() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<GoalEntryPage />} />
        <Route path="/deck" element={<h1>Recipe deck destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GoalEntryPage", () => {
  beforeEach(() => {
    parseGoal.mockReset();
    saveGoal.mockReset();
    clearDeckSessions(USER_ID);
    window.sessionStorage.clear();
  });

  it("renders the prompt without making a request and keeps blank goals disabled", () => {
    renderGoalEntry();

    expect(
      screen.getByRole("heading", { name: "What are you in the mood for today?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start swiping" })).toBeDisabled();
    expect(parseGoal).not.toHaveBeenCalled();
    expect(saveGoal).not.toHaveBeenCalled();
  });

  it("trims the goal, parses before saving, and navigates only after both requests succeed", async () => {
    const user = userEvent.setup();
    const callOrder = [];
    const parsedFilter = {
      diet: "vegan",
      maxReadyTime: 30,
      excludeIngredients: ["peanuts"],
    };

    parseGoal.mockImplementation(async (text) => {
      callOrder.push(`parse:${text}`);
      return { parsedFilter };
    });
    saveGoal.mockImplementation(async (userId, rawText, filter) => {
      callOrder.push(`save:${userId}:${rawText}`);
      expect(filter).toBe(parsedFilter);
      return { success: true };
    });

    renderGoalEntry();
    await user.type(screen.getByLabelText("Your food goal"), "  vegan, quick meals  ");
    await user.click(screen.getByRole("button", { name: "Start swiping" }));

    expect(
      await screen.findByRole("heading", { name: "Recipe deck destination" }),
    ).toBeInTheDocument();
    expect(parseGoal).toHaveBeenCalledWith(
      "vegan, quick meals",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(saveGoal).toHaveBeenCalledWith(
      USER_ID,
      "vegan, quick meals",
      parsedFilter,
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(callOrder).toEqual([
      "parse:vegan, quick meals",
      `save:${USER_ID}:vegan, quick meals`,
    ]);
  });

  it("locks the form while submitting and ignores a second submission", async () => {
    const parsed = createDeferred();
    const saved = createDeferred();
    parseGoal.mockReturnValue(parsed.promise);
    saveGoal.mockReturnValue(saved.promise);

    renderGoalEntry();
    const input = screen.getByLabelText("Your food goal");
    const form = input.closest("form");
    fireEvent.change(input, { target: { value: "high protein" } });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(parseGoal).toHaveBeenCalledTimes(1);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finding matches..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finding matches..." })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Parsing your goal and tuning your recipe feed...",
    );

    parsed.resolve({ parsedFilter: { minProtein_g: 30 } });
    await waitFor(() => expect(saveGoal).toHaveBeenCalledTimes(1));
    expect(input).toBeDisabled();
    fireEvent.submit(form);
    expect(parseGoal).toHaveBeenCalledTimes(1);

    saved.resolve({ success: true });
    expect(
      await screen.findByRole("heading", { name: "Recipe deck destination" }),
    ).toBeInTheDocument();
  });

  it("enforces the 1000-character limit in state and exposes the live count", async () => {
    parseGoal.mockResolvedValue({ parsedFilter: {} });
    saveGoal.mockResolvedValue({ success: true });
    renderGoalEntry();

    const input = screen.getByLabelText("Your food goal");
    fireEvent.change(input, { target: { value: "x".repeat(1005) } });

    expect(input).toHaveAttribute("maxlength", "1000");
    expect(input).toHaveValue("x".repeat(1000));
    expect(screen.getByLabelText("1000 of 1000 characters")).toHaveTextContent(
      "1000/1000",
    );

    fireEvent.submit(input.closest("form"));
    await waitFor(() =>
      expect(parseGoal).toHaveBeenCalledWith(
        "x".repeat(1000),
        expect.objectContaining({ signal: expect.any(Object) }),
      ),
    );
  });

  it("shows a normalized backend error, restores the form, and clears it on edit", async () => {
    const user = userEvent.setup();
    parseGoal.mockRejectedValue({
      response: { data: { error: "  Please   make the goal more specific.  " } },
    });

    renderGoalEntry();
    const input = screen.getByLabelText("Your food goal");
    await user.type(input, "food");
    await user.click(screen.getByRole("button", { name: "Start swiping" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Please make the goal more specific.");
    expect(input).toBeEnabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "goal-entry-error");
    expect(saveGoal).not.toHaveBeenCalled();

    await user.type(input, " now");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it.each([
    [undefined, "missing"],
    [null, "null"],
    [[], "an array"],
    ["vegan", "a string"],
  ])("rejects an invalid parsed filter (%s: %s) without saving", async (parsedFilter) => {
    const user = userEvent.setup();
    parseGoal.mockResolvedValue({ parsedFilter });

    renderGoalEntry();
    await user.type(screen.getByLabelText("Your food goal"), "vegan");
    await user.click(screen.getByRole("button", { name: "Start swiping" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't create your recipe matches. Please try again.",
    );
    expect(saveGoal).not.toHaveBeenCalled();
  });

  it("uses a safe fallback for network errors and oversized server messages", async () => {
    const user = userEvent.setup();
    parseGoal.mockResolvedValue({ parsedFilter: { diet: "vegan" } });
    saveGoal.mockRejectedValue({
      response: { data: { error: "x".repeat(201) } },
    });

    renderGoalEntry();
    await user.type(screen.getByLabelText("Your food goal"), "vegan");
    await user.click(screen.getByRole("button", { name: "Start swiping" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't create your recipe matches. Please try again.",
    );
    expect(screen.queryByRole("heading", { name: "Recipe deck destination" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start swiping" })).toBeEnabled();
  });

  it("clears the previous goal's deck only after a new goal saves successfully", async () => {
    const user = userEvent.setup();
    const oldGoalVersion = "2026-07-11T16:00:00.000Z";
    const oldDeck = {
      recipes: [CACHED_RECIPE],
      currentIndex: 0,
      nextOffset: 10,
      hasMore: false,
    };
    writeDeckSession(USER_ID, oldGoalVersion, oldDeck);
    parseGoal.mockResolvedValue({ parsedFilter: { minProtein_g: 30 } });
    saveGoal.mockResolvedValue({ success: true });

    renderGoalEntry();
    await user.type(screen.getByLabelText("Your food goal"), "high protein");
    await user.click(screen.getByRole("button", { name: "Start swiping" }));

    expect(
      await screen.findByRole("heading", { name: "Recipe deck destination" }),
    ).toBeInTheDocument();
    expect(readDeckSession(USER_ID, oldGoalVersion)).toBeNull();
  });

  it("keeps the previous deck when saving the replacement goal fails", async () => {
    const user = userEvent.setup();
    const oldGoalVersion = "2026-07-11T16:00:00.000Z";
    const oldDeck = {
      recipes: [CACHED_RECIPE],
      currentIndex: 0,
      nextOffset: 10,
      hasMore: false,
    };
    writeDeckSession(USER_ID, oldGoalVersion, oldDeck);
    parseGoal.mockResolvedValue({ parsedFilter: { minProtein_g: 30 } });
    saveGoal.mockRejectedValue(new Error("network failed"));

    renderGoalEntry();
    await user.type(screen.getByLabelText("Your food goal"), "high protein");
    await user.click(screen.getByRole("button", { name: "Start swiping" }));

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(readDeckSession(USER_ID, oldGoalVersion)).toEqual(oldDeck);
  });
});
