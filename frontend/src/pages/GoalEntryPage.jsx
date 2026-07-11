import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseGoal, saveGoal } from "../api/client.js";
import { USER_ID } from "../constants.js";
import "./GoalEntryPage.css";

function GoalEntryPage() {
  const navigate = useNavigate();
  const [goalText, setGoalText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedGoal = goalText.trim();
  const canSubmit = trimmedGoal.length > 0 && !isSubmitting;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!trimmedGoal || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { parsedFilter } = await parseGoal(trimmedGoal);
      await saveGoal(USER_ID, trimmedGoal, parsedFilter);
      navigate("/deck");
    } catch {
      setErrorMessage("Something went wrong. Please check that the backend is running and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="goal-entry-page">
      <section className="goal-entry-panel" aria-labelledby="goal-entry-title">
        <p className="goal-entry-eyebrow">Recipe Match</p>
        <h1 id="goal-entry-title">What are you in the mood for today?</h1>
        <p className="goal-entry-subheading">
          Tell us your food goals and swipe through recipes made for you.
        </p>

        <form className="goal-entry-form" onSubmit={handleSubmit}>
          <label htmlFor="goal-input">Your food goal</label>
          <div className="goal-entry-row">
            <input
              id="goal-input"
              type="text"
              value={goalText}
              onChange={(event) => setGoalText(event.target.value)}
              placeholder="cutting carbs, high protein, quick meals under 30 minutes"
              disabled={isSubmitting}
              aria-describedby={errorMessage ? "goal-entry-error" : undefined}
            />
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Finding matches..." : "Start swiping"}
            </button>
          </div>

          {isSubmitting ? (
            <p className="goal-entry-status" role="status">
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

export default GoalEntryPage;
