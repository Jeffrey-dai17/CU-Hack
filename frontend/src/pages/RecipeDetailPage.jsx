import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRecipeById } from "../api/client.js";
import "./RecipeDetailPage.css";

const NUTRITION_STATS = [
  { key: "calories", label: "Calories", unit: "cal", tone: "coral" },
  { key: "protein_g", label: "Protein", unit: "g", tone: "green" },
  { key: "carbs_g", label: "Carbs", unit: "g", tone: "gold" },
  { key: "fat_g", label: "Fat", unit: "g", tone: "blue" },
];

function getNutritionReading(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return Math.round(value).toString();
}

function getMetadata(recipe) {
  const items = [];

  if (typeof recipe.readyInMinutes === "number" && Number.isFinite(recipe.readyInMinutes)) {
    items.push(`${recipe.readyInMinutes} min`);
  }

  if (typeof recipe.servings === "number" && Number.isFinite(recipe.servings)) {
    items.push(`serves ${recipe.servings}`);
  }

  return items.join(" - ");
}

function RecipeDetailPage() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadRecipe() {
      setIsLoading(true);
      setHasError(false);
      setRecipe(null);

      if (!id) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      try {
        const response = await getRecipeById(id);
        const isRecipe =
          response &&
          typeof response === "object" &&
          !Array.isArray(response) &&
          (response.id != null || response.title);

        if (!isCurrentRequest) {
          return;
        }

        if (!isRecipe) {
          setHasError(true);
          return;
        }

        setRecipe(response);
      } catch {
        if (isCurrentRequest) {
          setHasError(true);
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoading(false);
        }
      }
    }

    loadRecipe();

    return () => {
      isCurrentRequest = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <main className="recipe-detail-page recipe-detail-state-page">
        <section className="recipe-detail-state" aria-live="polite" aria-busy="true">
          <p className="recipe-detail-eyebrow">Recipe Match</p>
          <h1>Loading your recipe</h1>
          <p>Getting the full nutrition details ready...</p>
        </section>
      </main>
    );
  }

  if (hasError || !recipe) {
    return (
      <main className="recipe-detail-page recipe-detail-state-page">
        <section className="recipe-detail-state" role="alert">
          <p className="recipe-detail-eyebrow">Recipe unavailable</p>
          <h1>Couldn't load this recipe</h1>
          <p>The recipe may no longer be available, or the backend may be temporarily offline.</p>
          <Link className="recipe-detail-primary-link" to="/deck">
            <span aria-hidden="true">&larr;</span>
            Back to the deck
          </Link>
        </section>
      </main>
    );
  }

  return <LoadedRecipe recipe={recipe} />;
}

function LoadedRecipe({ recipe }) {
  const title =
    typeof recipe.title === "string" && recipe.title.trim()
      ? recipe.title.trim()
      : "Untitled recipe";
  const metadata = getMetadata(recipe);
  const diets = Array.isArray(recipe.diets)
    ? recipe.diets.filter((diet) => typeof diet === "string" && diet.trim())
    : [];
  const sourceUrl =
    typeof recipe.sourceUrl === "string" && recipe.sourceUrl.trim()
      ? recipe.sourceUrl.trim()
      : "";
  const macros = recipe.macros && typeof recipe.macros === "object" ? recipe.macros : {};
  const nutrition = {
    calories: recipe.calories,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
  };

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
          <RecipeHeroImage key={recipe.image || recipe.id} image={recipe.image} title={title} />

          <div className="recipe-detail-content">
            <header className="recipe-detail-header">
              <p className="recipe-detail-eyebrow">Your recipe match</p>
              <h1>{title}</h1>

              {metadata ? <p className="recipe-detail-metadata">{metadata}</p> : null}

              {diets.length > 0 ? (
                <ul className="recipe-detail-diets" aria-label="Recipe diets">
                  {diets.map((diet, index) => (
                    <li key={`${diet}-${index}`}>{diet}</li>
                  ))}
                </ul>
              ) : null}
            </header>

            <section className="recipe-detail-nutrition" aria-labelledby="nutrition-title">
              <div className="recipe-detail-nutrition-heading">
                <p>Recipe nutrition</p>
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
                      <dd>
                        <strong>{reading}</strong>
                        {reading !== "N/A" ? <span>{stat.unit}</span> : null}
                      </dd>
                      <dt>{stat.label}</dt>
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
                >
                  View full recipe instructions
                  <span aria-hidden="true">&nearr;</span>
                </a>
              ) : (
                <p className="recipe-detail-source-unavailable">Recipe instructions unavailable</p>
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
  const imageUrl = typeof image === "string" && image.trim() ? image.trim() : "";

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
      onError={() => setImageFailed(true)}
    />
  );
}

export default RecipeDetailPage;
