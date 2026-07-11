import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRecipeById } from "../api/client.js";
import "./RecipeDetailPage.css";

const MAX_PUBLIC_ERROR_LENGTH = 200;

const NUTRITION_STATS = [
  { key: "calories", label: "Calories", unit: "kcal", tone: "coral" },
  { key: "protein_g", label: "Protein", unit: "g", tone: "green" },
  { key: "carbs_g", label: "Carbs", unit: "g", tone: "gold" },
  { key: "fat_g", label: "Fat", unit: "g", tone: "blue" },
];

function getPublicErrorMessage(error) {
  const serverMessage = error?.response?.data?.error;

  if (typeof serverMessage === "string") {
    const normalizedMessage = serverMessage.replace(/\s+/g, " ").trim();

    if (normalizedMessage && normalizedMessage.length <= MAX_PUBLIC_ERROR_LENGTH) {
      return normalizedMessage;
    }
  }

  return "We couldn't load this recipe. Please try again.";
}

function getNutritionReading(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "N/A";
  }

  return Math.round(value).toString();
}

function getMetadata(recipe) {
  const items = [];

  if (
    typeof recipe.readyInMinutes === "number" &&
    Number.isFinite(recipe.readyInMinutes) &&
    recipe.readyInMinutes >= 0
  ) {
    items.push(`${Math.round(recipe.readyInMinutes)} min`);
  }

  if (typeof recipe.servings === "number" && Number.isFinite(recipe.servings)) {
    const servings = Math.round(recipe.servings);

    if (servings > 0) {
      items.push(`${servings} ${servings === 1 ? "serving" : "servings"}`);
    }
  }

  return items.join(" - ");
}

function formatDietLabel(value) {
  return value
    .toLocaleLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase())
    .replace(/\bFodmap\b/g, "FODMAP");
}

function getDietLabels(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set();
  const labels = [];

  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    const diet = candidate.trim();
    const key = diet.toLocaleLowerCase();

    if (!diet || seen.has(key)) {
      continue;
    }

    seen.add(key);
    labels.push(formatDietLabel(diet));
  }

  return labels;
}

function getSafeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const url = new URL(value.trim());

    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function RecipeDetailPage() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const errorHeadingRef = useRef(null);

  useEffect(() => {
    let isCurrentRequest = true;
    const controller = new AbortController();
    let requestTimer;

    setIsLoading(true);
    setErrorMessage("");
    setRecipe(null);

    if (!id) {
      setErrorMessage("This recipe link is incomplete.");
      setIsLoading(false);

      return () => {
        isCurrentRequest = false;
        controller.abort();
      };
    }

    async function loadRecipe() {
      try {
        const response = await getRecipeById(id, { signal: controller.signal });
        const isRecipe =
          response &&
          typeof response === "object" &&
          !Array.isArray(response) &&
          (response.id != null ||
            (typeof response.title === "string" && response.title.trim().length > 0));

        if (!isCurrentRequest) {
          return;
        }

        if (!isRecipe) {
          setErrorMessage("The recipe service returned incomplete details. Please try again.");
          return;
        }

        setRecipe(response);
      } catch (error) {
        if (isCurrentRequest && !controller.signal.aborted) {
          setErrorMessage(getPublicErrorMessage(error));
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    }

    // Strict Mode cleans up its first effect before this task starts, avoiding a duplicate request.
    requestTimer = window.setTimeout(() => {
      void loadRecipe();
    }, 0);

    return () => {
      isCurrentRequest = false;
      window.clearTimeout(requestTimer);
      controller.abort();
    };
  }, [id, retryCount]);

  useEffect(() => {
    if (isLoading || !errorMessage) return undefined;

    const frame = window.requestAnimationFrame(() => {
      errorHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [errorMessage, isLoading]);

  function retryRecipe() {
    setIsLoading(true);
    setErrorMessage("");
    setRetryCount((count) => count + 1);
  }

  if (isLoading) {
    return (
      <main className="recipe-detail-page recipe-detail-state-page" aria-busy="true">
        <section
          className="recipe-detail-state"
          role="status"
          aria-live="polite"
          aria-labelledby="recipe-loading-title"
        >
          <p className="recipe-detail-eyebrow">Recipe Match</p>
          <h1 id="recipe-loading-title">Loading your recipe</h1>
          <p>Getting the full nutrition details ready...</p>
        </section>
      </main>
    );
  }

  if (errorMessage || !recipe) {
    return (
      <main className="recipe-detail-page recipe-detail-state-page">
        <section
          className="recipe-detail-state"
          role="alert"
          aria-labelledby="recipe-error-title"
        >
          <p className="recipe-detail-eyebrow">Recipe unavailable</p>
          <h1 id="recipe-error-title" ref={errorHeadingRef} tabIndex="-1">
            Couldn't load this recipe
          </h1>
          <p>{errorMessage || "This recipe is unavailable."}</p>
          <div className="recipe-detail-state-actions">
            {id ? (
              <button
                className="recipe-detail-primary-link recipe-detail-retry-button"
                type="button"
                onClick={retryRecipe}
              >
                Try again
              </button>
            ) : null}
            <Link className="recipe-detail-secondary-link" to="/deck">
              <span aria-hidden="true">&larr;</span>
              Back to the deck
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <LoadedRecipe recipe={recipe} />;
}

function LoadedRecipe({ recipe }) {
  const headingRef = useRef(null);
  const title =
    typeof recipe.title === "string" && recipe.title.trim()
      ? recipe.title.trim()
      : "Untitled recipe";
  const metadata = getMetadata(recipe);
  const diets = getDietLabels(recipe.diets);
  const sourceUrl = getSafeHttpUrl(recipe.sourceUrl);
  const macros = recipe.macros && typeof recipe.macros === "object" ? recipe.macros : {};
  const nutrition = {
    calories: recipe.calories,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
  };

  useEffect(() => {
    document.title = `${title} | Recipe Match`;
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);

  return (
    <main className="recipe-detail-page">
      <div className="recipe-detail-shell">
        <nav className="recipe-detail-nav" aria-label="Recipe navigation">
          <Link className="recipe-detail-back-link" to="/deck">
            <span aria-hidden="true">&larr;</span>
            Keep swiping
          </Link>
          <span className="recipe-detail-brand">Recipe Match</span>
        </nav>

        <article className="recipe-detail-article">
          <RecipeHeroImage key={`${recipe.id}-${recipe.image || "no-image"}`} image={recipe.image} title={title} />

          <div className="recipe-detail-content">
            <header className="recipe-detail-header">
              <p className="recipe-detail-eyebrow">Your recipe match</p>
              <h1 ref={headingRef} tabIndex="-1">
                {title}
              </h1>

              {metadata ? <p className="recipe-detail-metadata">{metadata}</p> : null}

              {diets.length > 0 ? (
                <ul className="recipe-detail-diets" aria-label="Recipe diets">
                  {diets.map((diet) => (
                    <li key={diet}>{diet}</li>
                  ))}
                </ul>
              ) : null}
            </header>

            <section
              className="recipe-detail-nutrition"
              aria-labelledby="nutrition-title"
              aria-describedby="nutrition-serving-note"
            >
              <div className="recipe-detail-nutrition-heading">
                <p id="nutrition-serving-note">Nutrition per serving</p>
                <h2 id="nutrition-title">The numbers behind your match</h2>
              </div>

              <dl className="recipe-detail-nutrition-grid">
                {NUTRITION_STATS.map((stat) => {
                  const reading = getNutritionReading(nutrition[stat.key]);

                  return (
                    <div
                      className={`recipe-detail-stat recipe-detail-stat-${stat.tone}`}
                      key={stat.key}
                    >
                      <dt>{stat.label}</dt>
                      <dd>
                        <strong>{reading}</strong>
                        {reading !== "N/A" ? <span>{stat.unit}</span> : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            <footer className="recipe-detail-actions">
              {sourceUrl ? (
                <a
                  className="recipe-detail-primary-link"
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View full recipe instructions. Opens in a new tab."
                >
                  View full recipe instructions
                  <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <p className="recipe-detail-source-unavailable">Recipe instructions unavailable.</p>
              )}

              <Link className="recipe-detail-secondary-link" to="/deck">
                Back to recipe deck
              </Link>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}

function RecipeHeroImage({ image, title }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getSafeHttpUrl(image);

  if (!imageUrl || imageFailed) {
    return (
      <div
        className="recipe-detail-image-fallback"
        role="img"
        aria-label={`${title} image unavailable`}
      >
        <span>Recipe image unavailable</span>
      </div>
    );
  }

  return (
    <img
      className="recipe-detail-image"
      src={imageUrl}
      alt={title}
      decoding="async"
      fetchPriority="high"
      onError={() => setImageFailed(true)}
    />
  );
}

export default RecipeDetailPage;
