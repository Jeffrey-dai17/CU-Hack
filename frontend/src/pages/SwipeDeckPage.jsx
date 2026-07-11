import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRecipes, logSwipe } from "../api/client.js";
import { USER_ID } from "../constants.js";
import "./SwipeDeckPage.css";

const SWIPE_THRESHOLD = 100;
const FLY_OUT_DISTANCE = 540;

function formatMacro(value) {
  return typeof value === "number" ? `${Math.round(value)}g` : "N/A";
}

function formatCalories(value) {
  return typeof value === "number" ? `${Math.round(value)} cal` : "Calories N/A";
}

function formatTime(value) {
  return typeof value === "number" ? `${value} min` : "Time N/A";
}

function SwipeDeckPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwiping, setIsSwiping] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [swipeError, setSwipeError] = useState("");
  const [swipeRequest, setSwipeRequest] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRecipes() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await getRecipes(USER_ID);

        if (!isMounted) {
          return;
        }

        setRecipes(Array.isArray(response.recipes) ? response.recipes : []);
        setCurrentIndex(0);
      } catch {
        if (isMounted) {
          setErrorMessage("Could not load your recipe deck. Please check that the backend is running.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRecipes();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentRecipe = recipes[currentIndex];
  const nextRecipe = recipes[currentIndex + 1];

  async function completeSwipe(direction, recipe) {
    setSwipeError("");

    if (direction === "right") {
      try {
        await logSwipe(USER_ID, recipe.id, "right");
        navigate(`/recipe/${recipe.id}`);
      } catch {
        setSwipeError("Could not save that swipe. Please try again.");
        setIsSwiping(false);
        return false;
      }

      return true;
    }

    setCurrentIndex((index) => index + 1);
    setIsSwiping(false);

    void logSwipe(USER_ID, recipe.id, "left").catch(() => {
      setSwipeError("Could not save that skip, but you can keep swiping.");
    });

    return true;
  }

  function requestSwipe(direction) {
    if (!currentRecipe || isSwiping) {
      return;
    }

    setIsSwiping(true);
    setSwipeRequest({ direction, recipeId: currentRecipe.id, requestedAt: Date.now() });
  }

  function goToGoalEntry() {
    navigate("/");
  }

  if (isLoading) {
    return (
      <main className="swipe-deck-page">
        <section className="deck-state-panel" aria-live="polite">
          <p className="deck-eyebrow">Recipe Match</p>
          <h1>Building your deck</h1>
          <p>Loading recipes that match your food goal...</p>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="swipe-deck-page">
        <section className="deck-state-panel" role="alert">
          <p className="deck-eyebrow">Recipe Match</p>
          <h1>Deck unavailable</h1>
          <p>{errorMessage}</p>
          <button type="button" className="deck-secondary-button" onClick={goToGoalEntry}>
            Back to goal
          </button>
        </section>
      </main>
    );
  }

  if (recipes.length === 0) {
    return (
      <main className="swipe-deck-page">
        <section className="deck-state-panel">
          <p className="deck-eyebrow">No matches found</p>
          <h1>Try a different goal</h1>
          <p>No recipes matched this goal yet. Broaden your filters or try a different craving.</p>
          <button type="button" className="deck-secondary-button" onClick={goToGoalEntry}>
            Set a new goal
          </button>
        </section>
      </main>
    );
  }

  if (!currentRecipe) {
    return (
      <main className="swipe-deck-page">
        <section className="deck-state-panel">
          <p className="deck-eyebrow">All caught up</p>
          <h1>You have seen all the matches</h1>
          <p>Set a new food goal to build another recipe deck.</p>
          <button type="button" className="deck-secondary-button" onClick={goToGoalEntry}>
            Set a new goal
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="swipe-deck-page">
      <header className="deck-header">
        <div>
          <p className="deck-eyebrow">Recipe Match</p>
          <h1>Swipe your matches</h1>
          <p className="deck-progress">
            {currentIndex + 1} of {recipes.length}
          </p>
        </div>
        <button type="button" className="deck-secondary-button" onClick={goToGoalEntry}>
          Change goal
        </button>
      </header>

      <section className="deck-workspace" aria-label="Recipe swipe deck">
        <div className="deck-card-stage">
          {nextRecipe ? (
            <article className="recipe-card recipe-card-next" aria-hidden="true">
              <RecipeCardContent recipe={nextRecipe} />
            </article>
          ) : null}

          <SwipeableRecipeCard
            key={currentRecipe.id}
            recipe={currentRecipe}
            swipeRequest={swipeRequest}
            onSwipeStart={() => setIsSwiping(true)}
            onSwipeComplete={completeSwipe}
          />
        </div>

        <div className="deck-actions" aria-label="Swipe actions">
          <button
            type="button"
            className="deck-skip-button"
            onClick={() => requestSwipe("left")}
            disabled={isSwiping}
            aria-label="Skip recipe"
          >
            <span aria-hidden="true">×</span>
          </button>
          <button
            type="button"
            className="deck-like-button"
            onClick={() => requestSwipe("right")}
            disabled={isSwiping}
            aria-label="View recipe"
          >
            <span aria-hidden="true">♥</span>
          </button>
        </div>

        {swipeError ? (
          <p className="deck-swipe-error" role="alert">
            {swipeError}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function SwipeableRecipeCard({ recipe, swipeRequest, onSwipeStart, onSwipeComplete }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-8, 0, 8]);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    x.set(0);
    isAnimatingRef.current = false;
  }, [recipe.id, x]);

  const flyAway = useCallback(
    async (direction) => {
      if (isAnimatingRef.current) {
        return;
      }

      isAnimatingRef.current = true;
      onSwipeStart();

      const targetX = direction === "right" ? FLY_OUT_DISTANCE : -FLY_OUT_DISTANCE;
      await animate(x, targetX, { duration: 0.22, ease: "easeIn" });
      const didComplete = await onSwipeComplete(direction, recipe);

      if (!didComplete) {
        await animate(x, 0, { type: "spring", stiffness: 360, damping: 28 });
        isAnimatingRef.current = false;
      }
    },
    [onSwipeComplete, onSwipeStart, recipe, x],
  );

  useEffect(() => {
    if (!swipeRequest || swipeRequest.recipeId !== recipe.id || isAnimatingRef.current) {
      return;
    }

    void flyAway(swipeRequest.direction);
  }, [flyAway, recipe.id, swipeRequest]);

  function snapBack() {
    void animate(x, 0, { type: "spring", stiffness: 360, damping: 28 });
  }

  function handleDragEnd(_event, info) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      void flyAway("right");
      return;
    }

    if (info.offset.x < -SWIPE_THRESHOLD) {
      void flyAway("left");
      return;
    }

    snapBack();
  }

  return (
    <motion.article
      className="recipe-card recipe-card-active"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.96, y: 22 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ x, rotate }}
      onDragEnd={handleDragEnd}
    >
      <RecipeCardContent recipe={recipe} />
    </motion.article>
  );
}

function RecipeCardContent({ recipe }) {
  const macros = recipe.macros ?? {};
  const protein = formatMacro(macros.protein_g);
  const carbs = formatMacro(macros.carbs_g);
  const fat = formatMacro(macros.fat_g);

  return (
    <>
      {recipe.image ? (
        <img src={recipe.image} alt={recipe.title || "Recipe"} className="recipe-card-image" />
      ) : (
        <div className="recipe-card-image-fallback">Recipe</div>
      )}

      <div className="recipe-card-shade" />
      <div className="recipe-card-overlay">
        <div className="recipe-card-nutrition" aria-label="Recipe calories and macros">
          <strong>{formatCalories(recipe.calories)}</strong>
          <span>{protein} protein</span>
          <small>
            {carbs} carbs / {fat} fat
          </small>
        </div>

        <div>
          <h2>{recipe.title || "Untitled recipe"}</h2>
          <p className="recipe-card-meta">
            {formatTime(recipe.readyInMinutes)}
            {typeof recipe.servings === "number" ? ` - ${recipe.servings} servings` : ""}
          </p>
        </div>
      </div>
    </>
  );
}

export default SwipeDeckPage;
