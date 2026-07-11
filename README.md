# Recipe Match

Recipe Match is a full-stack hackathon MVP that converts a natural-language food goal into a swipeable recipe deck. Gemini parses the goal on the server, Spoonacular supplies recipes and per-serving nutrition, and the React interface records skips and accepted matches through the Express API.

Provider credentials stay in the ignored `backend/.env` file. Never place them in frontend variables: every `VITE_*` value is public browser code.

## Requirements

- Node.js 24 or newer
- npm 11
- Microsoft Edge for the configured Playwright browser suites
- Gemini and Spoonacular keys for the provider-backed application flow

## Deterministic setup

From the repository root in PowerShell:

```powershell
npm.cmd ci
npm.cmd run setup
```

The first command installs the small root process runner. `setup` performs lockfile-based installs in both application packages.

If this is a new checkout, copy `backend/.env.example` to `backend/.env` and add provider keys there. Do not overwrite an existing configured file.

## Run the complete application

```powershell
npm.cmd run dev
```

Open [http://localhost:5173](http://localhost:5173). The API listens at [http://localhost:3000/api](http://localhost:3000/api), with liveness at [http://localhost:3000/api/health](http://localhost:3000/api/health).

The root runner starts each npm script with its package as the working directory. In particular, the backend starts from `backend/`, so dotenv loads `backend/.env` normally. Stopping the root command stops both development processes.

## Verification

Run the complete deterministic matrix from the repository root:

```powershell
npm.cmd run verify
```

This runs backend tests and coverage, frontend tests, lint, coverage and build, the mocked browser regression suite, and the separate full-stack browser suite.

The full-stack suite can be run alone:

```powershell
npm.cmd run test:fullstack
```

That suite starts Vite and the actual Express app, sends the real browser Axios requests across the configured CORS boundary, and exercises the real routes and in-memory store. Only the Gemini and Spoonacular boundaries are replaced with deterministic test providers. The test launcher disables dotenv loading, does not read `backend/.env`, makes no billable calls, and is not a production fallback.

The existing frontend `test:e2e` suite remains a mocked UI/layout regression suite. A successful full-stack test additionally proves browser-to-Express compatibility; neither deterministic suite validates live credentials, provider quota, or current upstream availability.

Run the quota-consuming provider validation only when intentionally needed:

```powershell
npm.cmd --prefix backend run test:live
```

Application state is demo-only and process-local. Restarting the backend clears the current goal and swipe history.

