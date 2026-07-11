import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getApiErrorMessage,
  getCurrentGoal,
  getRecipes,
  logSwipe,
} from "../api/client.js";
import { USER_ID } from "../constants.js";
import {
  formatCalories,
  formatMacro,
  formatServings,
  formatTime,
  normalizeImageUrl,
} from "../utils/recipe.js";
import { getFlyOutDistance, getSwipeDirection } from "../utils/swipe.js";
import "./SwipeDeckPage.css";

function isUsableRecipe(recipe) {
  const hasValidId =
    (typeof recipe?.id === "string" && recipe.id.trim() !== "") ||
    (typeof recipe?.id === "number" && Number.isFinite(recipe.id));

  return (
    recipe &&
    typeof recipe === "object" &&
    !Array.isArray(recipe) &&
    hasValidId
  );
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const isMountedRef = useRef(true);
  const requestNumberRef = useRef(0);
  const pendingSwipeControllersRef = useRef(new Set());
  const stateHeadingRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    const pendingControllers = pendingSwipeControllersRef.current;

    return () => {
      isMountedRef.current = false;
      pendingControllers.forEach((controller) => controller.abort());
      pendingControllers.clear();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    async function loadDeck() {
      setIsLoading(true);
      setErrorMessage("");
      setSwipeError("");

      try {
        const goal = await getCurrentGoal(USER_ID, { signal: controller.signal });

        if (!isCurrent) return;
        if (goal == null) {
          isCurrent = false;
          navigate("/", { replace: true });
          return;
        }

        const response = await getRecipes(USER_ID, { signal: controller.signal });
        if (!isCurrent) return;

        const nextRecipes = Array.isArray(response?.recipes)
          ? response.recipes.filter(isUsableRecipe)
          : [];
        setRecipes(nextRecipes);
        setCurrentIndex(0);
      } catch (error) {
        if (isCurrent && !controller.signal.aborted) {
          setRecipes([]);
          setErrorMessage(
            getApiErrorMessage(error, "We couldn't load your recipe deck. Please try again."),
          );
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    const timer = window.setTimeout(loadDeck, 0);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadAttempt, navigate]);

  const currentRecipe = recipes[currentIndex];
  const nextRecipe = recipes[currentIndex + 1];

  useEffect(() => {
    const shouldFocusState =
      !isLoading && (Boolean(errorMessage) || recipes.length === 0 || !currentRecipe);

    if (!shouldFocusState) return undefined;

    const frame = window.requestAnimationFrame(() => {
      stateHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentIndex, currentRecipe, errorMessage, isLoading, recipes.length]);

  const createSwipeController = useCallback(() => {
    const controller = new AbortController();
    pendingSwipeControllersRef.current.add(controller);
    return controller;
  }, []);

  const releaseSwipeController = useCallback((controller) => {
    pendingSwipeControllersRef.current.delete(controller);
  }, []);

  const completeSwipe = useCallback(
    async (direction, recipe) => {
      if (!isMountedRef.current) return true;
      setSwipeError("");
      const controller = createSwipeController();

      if (direction === "right") {
        try {
          await logSwipe(USER_ID, String(recipe.id), "right", { signal: controller.signal });
          if (isMountedRef.current && !controller.signal.aborted) {
            navigate(`/recipe/${encodeURIComponent(recipe.id)}`);
          }
          return true;
        } catch (error) {
          if (!isMountedRef.current || controller.signal.aborted) return true;
          setSwipeError(getApiErrorMessage(error, "We couldn't save that swipe. Please try again."));
          return false;
        } finally {
          releaseSwipeController(controller);
        }
      }

      setCurrentIndex((index) => index + 1);
      setIsSwiping(false);

      void logSwipe(USER_ID, String(recipe.id), "left", { signal: controller.signal })
        .catch((error) => {
          if (isMountedRef.current && !controller.signal.aborted) {
            setSwipeError(
              getApiErrorMessage(error, "That skip wasn't saved, but you can keep swiping."),
            );
          }
        })
        .finally(() => releaseSwipeController(controller));
      return true;
    },
    [createSwipeController, navigate, releaseSwipeController],
  );

  const requestSwipe = useCallback(
    (direction) => {
      if (!currentRecipe || isSwiping) return;
      requestNumberRef.current += 1;
      setIsSwiping(true);
      setSwipeRequest({ direction, recipeId: currentRecipe.id, requestNumber: requestNumberRef.current });
    },
    [currentRecipe, isSwiping],
  );

  const handleSwipeStart = useCallback(() => setIsSwiping(true), []);
  const handleSwipeSettled = useCallback(() => setIsSwiping(false), []);
  const goToGoalEntry = useCallback(() => navigate("/"), [navigate]);
  const retryDeck = useCallback(() => {
    setIsLoading(true);
    setErrorMessage("");
    setLoadAttempt((value) => value + 1);
  }, []);

  if (isLoading) {
    return (
      <DeckState eyebrow="Recipe Match" title="Building your deck" busy>
        Loading recipes that match your food goal...
      </DeckState>
    );
  }

  if (errorMessage) {
    return (
      <DeckState eyebrow="Recipe Match" title="Deck unavailable" role="alert" headingRef={stateHeadingRef}>
        <p>{errorMessage}</p>
        <div className="deck-state-actions">
          <button type="button" className="deck-primary-button" onClick={retryDeck}>
            Try again
          </button>
          <button type="button" className="deck-secondary-button" onClick={goToGoalEntry}>
            Back to goal
          </button>
        </div>
      </DeckState>
    );
  }

  if (recipes.length === 0) {
    return (
      <DeckState eyebrow="No matches found" title="Try a different goal" headingRef={stateHeadingRef}>
        <p>No recipes matched this goal yet. Broaden your filters or try a different craving.</p>
        <button type="button" className="deck-secondary-button" onClick={goToGoalEntry}>
          Set a new goal
        </button>
      </DeckState>
    );
  }

  if (!currentRecipe) {
    return (
      <DeckState eyebrow="All caught up" title="You have seen all the matches" headingRef={stateHeadingRef}>
        <p>Set a new food goal to build another recipe deck.</p>
        <button type="button" className="deck-secondary-button" onClick={goToGoalEntry}>
          Set a new goal
        </button>
      </DeckState>
    );
  }

  return (
    <main className="swipe-deck-page">
      <header className="deck-header">
        <div>
          <p className="deck-eyebrow">Recipe Match</p>
          <h1>Swipe your matches</h1>
          <p className="deck-progress" role="status" aria-live="polite" aria-atomic="true">
            {currentIndex + 1} of {recipes.length}: {currentRecipe.title || "Untitled recipe"}
          </p>
        </div>
        <button
          type="button"
          className="deck-secondary-button"
          onClick={goToGoalEntry}
          disabled={isSwiping}
        >
          Change goal
        </button>
      </header>

      <section className="deck-workspace" aria-label="Recipe swipe deck">
        <div className="deck-card-stage">
          {nextRecipe ? (
            <article key={nextRecipe.id} className="recipe-card recipe-card-next" aria-hidden="true">
              <RecipeCardContent recipe={nextRecipe} />
            </article>
          ) : null}

          <SwipeableRecipeCard
            key={currentRecipe.id}
            recipe={currentRecipe}
            swipeRequest={swipeRequest}
            disabled={isSwiping}
            onSwipeStart={handleSwipeStart}
            onSwipeComplete={completeSwipe}
            onSwipeSettled={handleSwipeSettled}
          />
        </div>

        <div className="deck-actions" aria-label="Swipe actions">
          <button type="button" className="deck-skip-button" onClick={() => requestSwipe("left")} disabled={isSwiping} aria-label="Skip recipe">
            <span aria-hidden="true">×</span>
          </button>
          <button type="button" className="deck-like-button" onClick={() => requestSwipe("right")} disabled={isSwiping} aria-label="View recipe">
            <span aria-hidden="true">♥</span>
          </button>
        </div>

        {swipeError ? <p className="deck-swipe-error" role="alert">{swipeError}</p> : null}
      </section>
    </main>
  );
}

function DeckState({ eyebrow, title, children, busy = false, role, headingRef }) {
  return (
    <main className="swipe-deck-page swipe-deck-state-page">
      <section className="deck-state-panel" aria-live={busy ? "polite" : undefined} aria-busy={busy || undefined} role={role}>
        <p className="deck-eyebrow">{eyebrow}</p>
        <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1>
        {typeof children === "string" ? <p>{children}</p> : children}
      </section>
    </main>
  );
}

function SwipeableRecipeCard({ recipe, swipeRequest, disabled, onSwipeStart, onSwipeComplete, onSwipeSettled }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-8, 0, 8]);
  const prefersReducedMotion = useReducedMotion();
  const isAnimatingRef = useRef(false);
  const cardRef = useRef(null);

  useEffect(() => {
    x.set(0);
    isAnimatingRef.current = false;
  }, [recipe.id, x]);

  const flyAway = useCallback(async (direction) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    onSwipeStart();

    const cardWidth = cardRef.current?.getBoundingClientRect().width || 430;
    const distance = getFlyOutDistance(window.innerWidth, cardWidth);
    const targetX = direction === "right" ? distance : -distance;

    try {
      if (prefersReducedMotion) x.set(targetX);
      else await animate(x, targetX, { duration: 0.28, ease: "easeIn" });

      const didComplete = await onSwipeComplete(direction, recipe);
      if (!didComplete) {
        if (prefersReducedMotion) x.set(0);
        else await animate(x, 0, { type: "spring", stiffness: 360, damping: 28 });
        isAnimatingRef.current = false;
        onSwipeSettled();
      }
    } catch {
      isAnimatingRef.current = false;
      onSwipeSettled();
    }
  }, [onSwipeComplete, onSwipeSettled, onSwipeStart, prefersReducedMotion, recipe, x]);

  useEffect(() => {
    if (!swipeRequest || swipeRequest.recipeId !== recipe.id || isAnimatingRef.current) return;
    void flyAway(swipeRequest.direction);
  }, [flyAway, recipe.id, swipeRequest]);

  function snapBack() {
    if (prefersReducedMotion) x.set(0);
    else void animate(x, 0, { type: "spring", stiffness: 360, damping: 28 });
  }

  function handleDragEnd(_event, info) {
    const direction = getSwipeDirection(info.offset.x);
    if (direction) void flyAway(direction);
    else snapBack();
  }

  const titleId = `recipe-${recipe.id}-title`;
  return (
    <motion.article
      ref={cardRef}
      className="recipe-card recipe-card-active"
      aria-labelledby={titleId}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      dragMomentum={false}
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: "easeOut" }}
      style={{ x, rotate }}
      onDragEnd={handleDragEnd}
    >
      <RecipeCardContent recipe={recipe} titleId={titleId} />
    </motion.article>
  );
}

function RecipeCardContent({ recipe, titleId }) {
  const macros = recipe.macros && typeof recipe.macros === "object" && !Array.isArray(recipe.macros) ? recipe.macros : {};
  const title = typeof recipe.title === "string" && recipe.title.trim() ? recipe.title.trim() : "Untitled recipe";
  const servings = formatServings(recipe.servings);

  return (
    <>
      <RecipeCardImage image={recipe.image} title={title} />
      <div className="recipe-card-shade" aria-hidden="true" />
      <div className="recipe-card-overlay">
        <div className="recipe-card-nutrition" aria-label="Nutrition per serving">
          <strong>{formatCalories(recipe.calories)}</strong>
          <span>{formatMacro(macros.protein_g)} protein</span>
          <small>{formatMacro(macros.carbs_g)} carbs / {formatMacro(macros.fat_g)} fat</small>
          <small className="recipe-card-serving-note">Per serving</small>
        </div>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p className="recipe-card-meta">
            {formatTime(recipe.readyInMinutes)}{servings ? ` · ${servings}` : ""}
          </p>
        </div>
      </div>
    </>
  );
}

function RecipeCardImage({ image, title }) {
  const imageUrl = normalizeImageUrl(image);
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageUrl || imageFailed) {
    return <div className="recipe-card-image-fallback" role="img" aria-label={`${title} image unavailable`}>Recipe image unavailable</div>;
  }

  return <img src={imageUrl} alt={title} className="recipe-card-image" draggable="false" onError={() => setImageFailed(true)} />;
}

export default SwipeDeckPage;
