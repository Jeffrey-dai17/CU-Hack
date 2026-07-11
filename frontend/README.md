# Recipe Match Frontend

Recipe Match turns a natural-language food goal into a swipeable recipe deck. The interface keeps calories, protein, carbohydrates, and fat visible while the user decides, records every swipe through the backend, and opens the exact accepted recipe on a detail page.

This directory contains the React frontend only. Recipe parsing, saved goals, recipe-provider requests, and API keys belong to the backend.

## Requirements

- Node.js 24 or newer
- npm 11 (the repository records the tested package-manager version)
- The Recipe Match backend running at `http://localhost:3000`

On Windows PowerShell, use `npm.cmd` instead of `npm` so execution policy does not block `npm.ps1`.

## Local development

From `frontend/`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. Vite uses that port in strict mode because the backend's local CORS allowlist expects that exact origin. If the port is occupied, Vite exits instead of silently starting on a CORS-blocked port.

The frontend calls `http://localhost:3000/api` by default. A different backend can be selected with a non-secret Vite environment value:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api
```

Every `VITE_` value is embedded in browser code. Never place Gemini, Spoonacular, ElevenLabs, or other secrets in a frontend environment file.

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Start the fixed-port Vite development server. |
| `npm.cmd run build` | Create the production bundle in `dist/`. |
| `npm.cmd run preview` | Serve the production bundle at `http://localhost:5173`. |
| `npm.cmd run lint` | Run Oxlint across the frontend. |
| `npm.cmd run test` | Run the Vitest unit/component suite once. |
| `npm.cmd run test:watch` | Run Vitest in watch mode. |
| `npm.cmd run test:coverage` | Run Vitest and enforce coverage thresholds. |
| `npm.cmd run test:e2e` | Run the Playwright browser suite. |
| `npm.cmd run test:all` | Run lint, coverage, production build, and browser regressions. |

The browser suite uses the Microsoft Edge installation already present on the demo laptop. In a clean CI environment, install Edge with Playwright before running `test:e2e`.

## Application flow

| Route | Screen | Behavior |
| --- | --- | --- |
| `/` | Goal entry | Parses and saves a natural-language food goal. Loading this route does not make an API request. |
| `/deck` | Swipe deck | Requires a saved goal, fetches recipes, skips left, and accepts right. |
| `/recipe/:id` | Recipe detail | Fetches the selected recipe and presents nutrition and source information. |

The demo user is fixed as `demo-user-1` in `src/constants.js`. There is no authentication or client-side goal/deck cache in the MVP.

## Testing strategy

- Vitest and Testing Library cover the API boundary, route behavior, goal submission, swipe state machine, failure recovery, recipe detail, accessibility semantics, and formatting helpers.
- MSW intercepts the real Axios requests only inside tests. It is a development dependency and creates no production fallback or mock-data path.
- Playwright runs against Microsoft Edge and a real Vite server. Its test-only network routes verify the complete flow and responsive layout at laptop, 390px, and 320px viewports.
- `test:coverage` enforces 85% statements, lines, and functions plus 80% branches across production JavaScript.

## Backend contract

All network access is centralized in `src/api/client.js` and uses the backend `/api` routes:

- `POST /parse-goal`
- `POST /goal`
- `GET /goal/current?userId=...`
- `GET /recipes?userId=...`
- `GET /recipes/:id`
- `POST /swipe`

API helpers return `response.data`, accept an optional Axios request config for cancellation, and let failures propagate to page-level error handling. The frontend never calls Gemini, Spoonacular, or another recipe provider directly.

## Project structure

```text
src/
  api/client.js              Backend API boundary
  components/RouteEffects.* Route title, focus, and scroll management
  pages/GoalEntryPage.*      Goal capture and save flow
  pages/SwipeDeckPage.*      Recipe deck and swipe behavior
  pages/RecipeDetailPage.*   Selected recipe and nutrition detail
  test/                      Shared Vitest and MSW setup
  utils/                     Tested formatting and swipe geometry
  App.jsx                    Route table and route-level behavior
  constants.js               Demo user identifier
  index.css                  Shared tokens and global styles
e2e/                         Edge-backed browser regressions
```

## Pre-demo verification

1. Start the backend on port `3000` with its provider keys configured server-side.
2. Run `npm.cmd run test:all` to lint, enforce coverage, build, and execute browser regressions.
3. Start the frontend and submit a representative goal from `/`.
4. Confirm the deck loads, a left swipe advances, and a right swipe opens the same recipe that was accepted.
5. Confirm the detail page shows per-serving calories and macros and can return to the deck.
6. Check the flow at a laptop-sized viewport and near `390px` wide with no horizontal overflow.
