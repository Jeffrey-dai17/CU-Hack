import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { USER_ID } from "../constants.js";
import { getLikedRecipes } from "../utils/likedRecipes.js";
import { formatCalories, formatServings, formatTime, normalizeImageUrl } from "../utils/recipe.js";
import "./LikedRecipesPage.css";

function LikedRecipesPage() {
  const navigate = useNavigate();
  const likedRecipes = getLikedRecipes(USER_ID);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const goToDeck = () => navigate("/deck");

  return (
    <main className="liked-recipes-page">
      <header className="liked-header">
        <div>
          <p className="liked-eyebrow">Recipe Match</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Your liked recipes
          </h1>
          <p className="liked-subtitle">
            {likedRecipes.length === 0
              ? "Nothing liked yet this session."
              : `${likedRecipes.length} recipe${likedRecipes.length === 1 ? "" : "s"} you've liked this session.`}
          </p>
        </div>
        <button type="button" className="deck-secondary-button" onClick={goToDeck}>
          Back to deck
        </button>
      </header>

      {likedRecipes.length === 0 ? (
        <section className="liked-empty-state">
          <p>Swipe right on a recipe you like and it'll show up here.</p>
          <button type="button" className="deck-primary-button" onClick={goToDeck}>
            Start swiping
          </button>
        </section>
      ) : (
        <section className="liked-grid" aria-label="Liked recipes">
          {likedRecipes.map((recipe) => (
            <LikedRecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </section>
      )}
    </main>
  );
}

function LikedRecipeCard({ recipe }) {
  const title = typeof recipe.title === "string" && recipe.title.trim() ? recipe.title.trim() : "Untitled recipe";
  const servings = formatServings(recipe.servings);
  const meta = [formatTime(recipe.readyInMinutes), servings].filter(Boolean).join(" - ");

  return (
    <Link
      className="liked-card"
      to={`/recipe/${encodeURIComponent(recipe.id)}`}
      state={{ recipe }}
    >
      <div className="liked-card-image-wrap">
        <LikedRecipeImage image={recipe.image} title={title} />
      </div>
      <div className="liked-card-body">
        <h2>{title}</h2>
        <p className="liked-card-meta">{meta}</p>
        <p className="liked-card-calories">{formatCalories(recipe.calories)}</p>
      </div>
    </Link>
  );
}

function LikedRecipeImage({ image, title }) {
  const imageUrl = normalizeImageUrl(image);
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageUrl || imageFailed) {
    return (
      <div className="liked-card-image-fallback" role="img" aria-label={`${title} image unavailable`}>
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={title}
      className="liked-card-image"
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}

export default LikedRecipesPage;
