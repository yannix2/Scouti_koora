# ScoutiKoora — Agent Instructions

## Quick start
```powershell
venv\Scripts\activate        # activate venv (Windows)
cp .env.example .env         # edit with your Neon DB URL + JWT secret
pip install -r requirements.txt
alembic upgrade head         # create DB tables
.\start_services.ps1         # start all backend services (Ctrl+C to stop)

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                  # http://localhost:3000
```
API docs: `http://localhost:8000/docs`

## Architecture — microservices
| Service | Port | What it does |
|---|---|---|
| `services/player_service/` | 8001 | Loads `player_snapshot.csv` → `/players`, `/recommend`, `/hidden-gems`, `/compare`, `/styles` |
| `services/similarity_service/` | 8002 | Loads KNN model → `/similar/{name}` |
| **Gateway** `src/api/main.py` | 8000 | Auth routes + proxies to services via httpx |

To start individually:
```powershell
uvicorn services.player_service.main:app --port 8001
uvicorn services.similarity_service.main:app --port 8002
uvicorn src.api.main:app --port 8000
```

## Project structure at a glance
- **Notebooks** (`notebooks/`): Actual model training lives here (01–09). These are the source of truth for model code, not the `.py` stubs.
- **`services/`**: Microservices — each loads only the model artifacts it needs. Player service (snapshot CSV), similarity service (KNN pickle).
- **`src/api/main.py`**: Thin gateway. Auth routes are local; data/SDL routes proxy to microservices via httpx.
- **`src/data/`**: Scrapers only. `pipeline.py`, `feature_engineering.py`, `schemas.py` are **empty stubs** — notebook 03 does the actual feature engineering.
- **`src/db/`**: SQLAlchemy async models + Alembic migrations (Neon PostgreSQL).
- **`src/auth/`**: JWT auth (register/login/refresh/me) using bcrypt + python-jose.
- **`src/middleware/auth.py`**: `get_current_user` dependency guard. Import and reuse.
- **`data/processed/`**: Pre-computed model artifacts (`.pkl`, `.csv`) loaded by microservices on startup.
- **`frontend/`**: Next.js 15 app (App Router, TypeScript, Tailwind v4, PostCSS).

## Scraping quirks
- Uses `nodriver` (undocumented Chrome automation library), not plain `requests`+`BeautifulSoup`.
- Requires a Chrome browser profile (`PROFILE_PATH` at the top of each scraper). Path differs between scrapers (`Lenovo` vs `Yassine`) — update for your machine.
- Checkpoint JSON files (`data/scraped/checkpoint*.json`) track which leagues/seasons are already scraped — delete them to force a full re-scrape.
- Windows async fix required: `asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())`
- FBref: mandatory 4-second delay between requests. soccerdata lib available for Big 5 leagues.

## Data
- Transfermarkt Kaggle CSVs live in `data/raw/` (13 files, gitignored).
- Scraped FBref/Transfermarkt data goes to `data/scraped/`. Already has `ALL_STATS.csv`, `TM_PLAYER_VALUES.csv`, etc.
- `.gitignore` blocks **all `.csv` files** and the entire `data/` directory. Do not commit data files.

## Model training flow
Notebooks 01 (exploration) → 02 (scrape) → 03 (feature engineering) → 04 (KNN similarity) → 05 (XGBoost talent score) → 06 (K-Means clustering) → 07 (recommendation engine) → 08 (FastAPI) → 09 (frontend). Run notebooks in order; each reads/writes from `data/processed/`.

## No tests, no CI, no linting
This is an academic project with no test framework, no CI pipeline, and no linter/formatter config. Verify manually or add infrastructure as needed.

## API endpoints (FastAPI on port 8000)
| Endpoint | Description |
|---|---|
| `POST /auth/register` | Create account (scout/agent/club) |
| `POST /auth/login` | Login → JWT tokens |
| `POST /auth/refresh` | Refresh access token |
| `GET  /auth/me` | Current user (requires JWT) |
| `GET /health` | Status + player/style counts |
| `GET /players?q=<query>` | Autocomplete search |
| `GET /similar/{name}` | KNN similarity (supports `?same_position=true`) |
| `GET /recommend` | Multi-filter recommendations |
| `GET /hidden-gems` | High talent + low value players |
| `GET /compare?player_a=X&player_b=Y` | Side-by-side comparison |
| `GET /styles` | List available play-style labels |
| `GET /scouting/saved` | My saved players |
| `POST /scouting/saved` | Save a player with notes |
| `DELETE /scouting/saved/{name}` | Unsave |
| `GET /scouting/lists` | My lists + public lists |
| `POST /scouting/lists` | Create scouting list |
| `GET /scouting/lists/{id}` | List detail with items |
| `PUT /scouting/lists/{id}` | Update list |
| `DELETE /scouting/lists/{id}` | Delete list |
| `POST /scouting/lists/{id}/items` | Add player to list |
| `DELETE /scouting/lists/{id}/items/{id}` | Remove from list |
| `POST /scouting/track` | Log interaction (view/save/compare/search) |
| `GET /scouting/history` | My recent interaction history |
| `GET /recommendations/personalized` | Hybrid recs (content + collaborative) |
| `GET /recommendations/for-player/{name}` | Content-based recs for a player |
| `GET /recommendations/trending` | Most-viewed players across all users |
| `GET /radar/{name}` | Normalized 0-100 radar scores (10 axes + 5 categories) |
| `GET /report/{name}` | Structured scouting report with strengths/weaknesses, value, injury risk, verdict |
