# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ScoutiKoora is an academic AI/BI project (TEK-UP, Projet AI & BI) for football talent discovery: FBref + Transfermarkt data → KNN similarity, XGBoost talent score, K-Means play-style clusters → FastAPI backend. `AGENTS.md` has the full endpoint table; `README.md` documents the raw Kaggle dataset schemas. Much of the README (project structure, `src/models/`, `pipeline.py` usage, BeautifulSoup scraping) describes the original plan, not the current code.

## Commands (Windows / PowerShell, run from repo root)

```powershell
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head            # apply DB migrations (src/db/migrations)
.\start_services.ps1            # runs run_backend.py: starts all 3 services, waits on /health, opens /docs
docker compose up --build       # alternative; mounts ./data into each container
```

Run a single service (`PYTHONPATH` must be the repo root because imports are `src.…` / `services.…`):
```powershell
uvicorn services.player_service.main:app --port 8001
uvicorn services.similarity_service.main:app --port 8002
uvicorn src.api.main:app --port 8000 --reload
```

`run_backend.py` redirects each service's stdout/stderr to `services/logs/<name>.log|.err`. Check those files when a service fails at startup. A missing artifact in `data/processed/` is the usual cause.

New migration: `alembic revision --autogenerate -m "..."`. `env.py` reads the URL from `src.config` settings, not from `alembic.ini`.

The backend has no tests, linter or CI. `pytest`/`pytest-asyncio` are listed in requirements, but no test files exist. Verify backend changes by hitting endpoints on `http://localhost:8000/docs`. The frontend has Playwright smoke tests (see Frontend).

## Architecture

Three FastAPI processes:

- **Player service** (`services/player_service/main.py`, :8001): on startup it loads `player_snapshot.csv` and left-merges `style_clusters.csv` / `talent_scores.csv` on `(Player, season)` if those columns are missing. It then builds `latest`, one row per player for their most recent season. All endpoints query `latest`. Position filters use one-hot columns `pos_FW/pos_MF/pos_DF/pos_GK`.
- **Similarity service** (`services/similarity_service/main.py`, :8002): loads `knn_similarity_model.pkl`, `similarity_features.pkl`, `player_index.csv`, `feature_matrix_scaled.csv`. **Rows of `player_index.csv` and `feature_matrix_scaled.csv` are positionally aligned**: lookup is `X_scaled[player_index row]`. Regenerate both together (notebook 04).
- **Gateway** (`src/api/main.py`, :8000): the only service clients talk to. It owns the following:
  - Auth (`src/auth/`) and the DB-backed routers `src/api/routes/scouting.py` and `src/api/routes/recommendations.py`. The recommendations router mixes content-based recs (it calls the similarity service directly) with collaborative filtering over `PlayerView`/`SavedPlayer`.
  - Proxied data routes that go through `_map_player`, which **renames service fields for the frontend**: `primary_pos→Position`, `league→League`, `market_value_eur→"Market Value"` (a formatted € string), `predicted_talent→"Talent Score"`. If you add a field to a service response, check whether the gateway needs to map it.
  - `/radar/{name}` and `/report/{name}`, which are computed **in the gateway** from the raw `/players/{name}` profile (no mapping). Normalization caps are in `_STAT_MAXES`, and verdict thresholds are in `_get_verdict`.
  - Service URLs come from the `PLAYER_SERVICE` / `SIMILARITY_SERVICE` env vars, defaulting to `127.0.0.1`. docker-compose overrides them.

Player lookup works the same way in every service. Names are accent-stripped and lowercased via `norm()`, matched exactly first, then by substring, and the first hit wins.

**Database:** async SQLAlchemy plus asyncpg on Neon Postgres. Models are in `src/db/models.py`: `User` (role: scout/agent/club), `SavedPlayer`, `ScoutingList`, `ScoutingListItem`, `PlayerView`. The project is linked to Neon via `neon.ts` / `.neon`. `neon env pull` writes `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used by Alembic) into `.env` as plain `postgresql://…` URLs. `to_asyncpg_url()` in `src/config.py` rewrites them to `postgresql+asyncpg://` and strips libpq query params, and SSL is passed via `connect_args`. Settings load from `.env` via `pydantic-settings` with `extra="ignore"`, so Neon's extra keys don't break startup. To protect a route, depend on `get_current_user` from `src/middleware/auth.py`.

## ML pipeline: notebooks are the source of truth

All model training and feature engineering live in `notebooks/01–09`, run in order. Each one reads from and writes to `data/processed/` (`.pkl`, `.csv`, `nbXX_summary.json`) and saves plots to `reports/`. The services only load these precomputed artifacts and never train. If you change the features, columns or models, edit the notebook and rerun it, then restart the services.

Empty placeholder files (0 bytes, don't treat as real code): `src/data/pipeline.py`, `src/data/feature_engineering.py`, `src/api/schemas.py`, `src/api/routes/{players,recommend,similarity}.py`. `services/recommendation_service/` is an empty directory. Several notebooks hardcode paths like `C:/Users/Lenovo/Scouti_Koora`, so update `ROOT` when running them on another machine.

## Scrapers (`src/data/scraper_*.py`)

- They use `nodriver` (Chrome automation), not requests/BeautifulSoup. Each needs `PROFILE_PATH` at the top of the file set to a local Chrome profile.
- Windows needs `asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())`.
- FBref requires a 4-second delay between requests.
- Output goes to `data/scraped/`. `data/scraped/checkpoint*.json` records which leagues and seasons are done; delete those files to force a full re-scrape.

## Data / git

`data/` and all `*.csv` files are gitignored. Never commit data or model artifacts. Raw Transfermarkt Kaggle CSVs go in `data/raw/`.

## Frontend

`frontend/` is a Next.js 16 app (App Router, `cacheComponents` + `partialPrefetching` on), with Tailwind v4, shadcn/ui (Radix, RTL mode), motion, TanStack Query and nuqs. Next 16 differs from older training data. **Read `frontend/node_modules/next/dist/docs/` before changing framework-level code**: for example, `proxy.ts` replaces `middleware.ts`, `params` are Promises, and request data must be read inside `<Suspense>`.

```powershell
cd frontend; npm install
npm run dev          # http://localhost:3000; needs the backend on API_URL (frontend/.env.local, default http://127.0.0.1:8000)
npm run build        # must pass; the build never calls the backend
npm run typecheck    # next typegen + tsc
npm run test:e2e     # Playwright smoke tests against a running dev server + backend; -g "<name>" runs one
```

- **Routing and i18n:**
  - Every page lives under `app/[locale]/` (en/fr/ar).
  - The locale comes from `next/root-params` via `getDictionary()`/`getLocale()` in `i18n/dictionaries.ts`, and client components use `useI18n()`.
  - Strings live in `i18n/dictionaries/{en,fr,ar}.json` and all three must keep the same keys.
  - Arabic is RTL, so use logical Tailwind classes (`ms-`/`ps-`/`start-`), not `ml-`/`left-`.
  - `proxy.ts` redirects to a locale and guards `/scouting`.
- **Data:**
  - Server components fetch the gateway through `'use cache'` functions in `lib/api/server.ts`, behind `await connection()` inside `<Suspense>`.
  - Browser calls go through `lib/api/client.ts` to the BFF proxy `app/api/gw/[...path]`, which forwards to the gateway with the Bearer token.
  - Auth (`app/api/auth/[action]`) keeps JWTs in httpOnly cookies (`sk_at`/`sk_rt`, see `lib/session.ts`). Browser code never sees the tokens.
  - Responses are parsed with the loose zod schemas in `lib/api/schemas.ts`.
- **Player identity:** players have no IDs, so URLs use the name with `_` for spaces (`lib/players.ts`).
- **Design:**
  - The visual direction is "Marked Pitch". Tokens are in `app/globals.css`, with light and dark ("floodlit") palettes and turf-tinted shadows.
  - The direction contract is `.impeccable/surfaces/frontend-app-locale-page-tsx.md`, and product truth is `PRODUCT.md`.
  - The signature component is `features/desk/pitch.tsx`.

Notebook 09 also generates an older static React app into `src/frontend/`; the Next.js app replaces it.
