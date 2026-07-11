# Recipe Swipe Backend

Express API for the hackathon recipe swipe app.

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Fill `.env` when keys are available:

```env
PORT=3000
GEMINI_API_KEY=your_key_here
SPOONACULAR_API_KEY=your_key_here
ELEVENLABS_API_KEY=
```

The app still responds without API keys. Goal parsing uses a simple local fallback, and recipe endpoints return fallback demo recipes with `[FALLBACK DEMO RECIPE - MADE UP]` in the title.

## API

- `POST /api/parse-goal`
- `POST /api/goal`
- `GET /api/goal/current?userId=...`
- `GET /api/recipes?userId=...`
- `GET /api/recipes/:id`
- `POST /api/swipe`

Run on `http://localhost:3000` by default.
