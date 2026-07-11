import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseGoal, saveGoal } from "../api/client.js";
import { USER_ID } from "../constants.js";
import "./GoalEntryPage.css";

const MAX_GOAL_LENGTH = 1000;
const MAX_PUBLIC_ERROR_LENGTH = 200;

function getPublicErrorMessage(error) {
  const serverMessage = error?.response?.data?.error;

  if (typeof serverMessage === "string") {
    const normalizedMessage = serverMessage.replace(/\s+/g, " ").trim();

    if (normalizedMessage && normalizedMessage.length <= MAX_PUBLIC_ERROR_LENGTH) {
      return normalizedMessage;
    }
  }

  return "We couldn't create your recipe matches. Please try again.";
}

function GoalEntryPage() {
  const navigate = useNavigate();
  const [goalText, setGoalText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const submissionControllerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      submissionControllerRef.current?.abort();
    };
  }, []);

  const trimmedGoal = goalText.trim();
  const canSubmit = trimmedGoal.length > 0 && !isSubmitting;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!trimmedGoal || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");
    const controller = new AbortController();
    submissionControllerRef.current = controller;

    try {
      const parsedGoal = await parseGoal(trimmedGoal, { signal: controller.signal });
      const parsedFilter = parsedGoal?.parsedFilter;

      if (!parsedFilter || typeof parsedFilter !== "object" || Array.isArray(parsedFilter)) {
        throw new Error("The goal parser returned an invalid response.");
      }

      await saveGoal(USER_ID, trimmedGoal, parsedFilter, { signal: controller.signal });
      if (isMountedRef.current && !controller.signal.aborted) navigate("/deck");
    } catch (error) {
      if (isMountedRef.current && !controller.signal.aborted) {
        setErrorMessage(getPublicErrorMessage(error));
        setIsSubmitting(false);
      }
    } finally {
      if (submissionControllerRef.current === controller) submissionControllerRef.current = null;
      isSubmittingRef.current = false;
    }
  }

  function handleGoalChange(event) {
    setGoalText(event.target.value.slice(0, MAX_GOAL_LENGTH));

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  const describedBy = [
    isSubmitting ? "goal-entry-status" : null,
    errorMessage ? "goal-entry-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="goal-entry-page">
      <section className="goal-entry-panel" aria-labelledby="goal-entry-title">
        <p className="goal-entry-eyebrow">Recipe Match</p>
        <h1 id="goal-entry-title">What are you in the mood for today?</h1>
        <p className="goal-entry-subheading">
          Tell us your food goals and swipe through recipes made for you.
        </p>

        <form className="goal-entry-form" onSubmit={handleSubmit}>
          <div className="goal-entry-label-row">
            <label htmlFor="goal-input">Your food goal</label>
            <span
              className="goal-entry-character-count"
              aria-label={`${goalText.length} of ${MAX_GOAL_LENGTH} characters`}
            >
              {goalText.length}/{MAX_GOAL_LENGTH}
            </span>
          </div>
          <div className="goal-entry-row">
            <input
              id="goal-input"
              type="text"
              value={goalText}
              onChange={handleGoalChange}
              placeholder="high protein, vegan, quick meals under 30 minutes"
              maxLength={MAX_GOAL_LENGTH}
              autoComplete="off"
              disabled={isSubmitting}
              aria-describedby={describedBy || undefined}
              aria-invalid={errorMessage ? "true" : undefined}
            />
            <button type="submit" disabled={!canSubmit} aria-busy={isSubmitting}>
              {isSubmitting ? "Finding matches..." : "Start swiping"}
            </button>
          </div>

          {isSubmitting ? (
            <p className="goal-entry-status" id="goal-entry-status" role="status">
              Parsing your goal and tuning your recipe feed...
            </p>
          ) : null}

          {errorMessage ? (
            <p className="goal-entry-error" id="goal-entry-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

export { GoalEntryPage };
export default GoalEntryPage;
