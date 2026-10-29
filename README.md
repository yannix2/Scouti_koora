# ⚽ ScoutiKoora — AI-Powered Football Talent Discovery System

> Discover hidden football talent across 32+ leagues worldwide using machine learning, real-time statistics, and business intelligence dashboards.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Data Sources](#-data-sources)
- [Dataset Reference](#-dataset-reference)
- [AI Models](#-ai-models)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Data Pipeline](#-data-pipeline)
- [League Coverage](#-league-coverage)
- [Target Users](#-target-users)
- [Roadmap](#-roadmap)
- [Team](#-team)

---

## 🎯 Project Overview

**ScoutiKoora** is an AI + BI application that helps football scouts, clubs, and agents discover undervalued talent across 32+ leagues worldwide. It combines real-time player statistics from FBref with market intelligence from Transfermarkt to power three machine learning models:

| Problem | Our Solution |
|---|---|
| Scouts miss talent in non-top leagues | We cover 32+ leagues including Brazil, Japan, Saudi Arabia, MLS |
| Expensive tools (Wyscout €1500+/yr) | Affordable SaaS starting at €49/month |
| Manual spreadsheet scouting | AI-powered similarity search and talent scoring |
| No style-based player search | K-Means clustering by play style per position |
| Gut-feel recruitment decisions | Data-driven recommendations with explainable scores |

**Module:** Projet AI & BI — Engineering 4th year  
**Academic year:** 2024–2025  
**Institution:** TEK-UP University

---

## ✨ Key Features

### 🤖 AI Features
- **Player Similarity Engine** — Input any reference player, get top 10 statistically similar players across all 32+ leagues using KNN + Cosine Similarity
- **Talent Score (0–100)** — XGBoost model trained on career trajectories rates every player's potential
- **Play Style Clustering** — K-Means groups players by style within a position (e.g., "Box-to-Box" vs "Deep Playmaker")
- **Smart Recommendations** — Input position + budget + age + preferred style → get top 5 recommended players with full scouting report

### 📊 BI Features
- **World Talent Map** — Geographic distribution of top talents by position and age
- **Radar Charts** — 6-dimension player profile comparison (attacking, defensive, physical, technical, progression, efficiency)
- **Player Progression Curve** — Career arc visualization across seasons
- **Value vs Performance Scatter** — Identify undervalued players (high stats, low market value)
- **League Benchmarking** — Compare talent distribution and average KPIs across all 32+ leagues
- **Transfer Radar** — Live rumors, contract expiry alerts, market value changes

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                 │
│                                                                      │
│   FBref.com (live scraping)        Transfermarkt (Kaggle + scraping) │
│   ├── 32+ leagues                  ├── 47,702 player profiles        │
│   ├── 6 stat types per league      ├── 616,377 valuation records     │
│   └── Per-90 advanced metrics      ├── 157,186 transfers             │
│                                    └── 1,862,208 appearances         │
└──────────────────────┬──────────────────────────┬───────────────────┘
                       │                          │
                       ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA PIPELINE (Python)                         │
│                                                                      │
│   1. Scraping       → BeautifulSoup + soccerdata + Requests          │
│   2. Cleaning       → Pandas (nulls, duplicates, outliers)           │
│   3. Feature Eng.   → Per-90 normalization, KPI computation          │
│   4. Name Matching  → unicodedata normalization across sources       │
│   5. Master Export  → master_scouting_dataset.csv                   │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                   ▼
        ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
        │   MODEL 1       │  │   MODEL 2       │  │   MODEL 3        │
        │   KNN +         │  │   XGBoost       │  │   K-Means +      │
        │   Cosine Sim.   │  │   Talent Score  │  │   PCA Clustering │
        └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘
                 └───────────────────┬┘───────────────────┘
                                     ▼
                    ┌────────────────────────────────┐
                    │    RECOMMENDATION ENGINE        │
                    │    FastAPI REST Backend         │
                    └────────────────┬───────────────┘
                                     ▼
                    ┌────────────────────────────────┐
                    │    FRONTEND APPLICATION         │
                    │    React + Plotly Dashboards    │
                    │    PDF Scouting Reports         │
                    └────────────────────────────────┘
```

---

## 📦 Data Sources

### Source 1 — FBref (Live Scraping)
> Real match statistics for all players across 32+ leagues

| Attribute | Value |
|---|---|
| URL | https://fbref.com |
| Method | BeautifulSoup + soccerdata Python library |
| Update frequency | Weekly |
| Rate limiting | 4-second delay between requests (mandatory) |

**Stat types scraped per league:**

| Stat Type | Key Columns |
|---|---|
| `standard` | Goals, assists, xG, xA, minutes played, matches |
| `shooting` | Shots, shots on target, xG per shot, average distance |
| `passing` | Pass completion %, progressive passes, key passes, xA |
| `defense` | Tackles, interceptions, pressures, blocks, clearances |
| `possession` | Dribbles completed, progressive carries, carries into final third |
| `misc` | Fouls committed, aerials won, yellow/red cards, recoveries |

**How to scrape FBref:**
```python
# Method A — soccerdata (Big 5 leagues, cleanest)
pip install soccerdata

import soccerdata as sd
fbref = sd.FBref(leagues=["ENG-Premier League", "ESP-La Liga"], seasons="2023-2024")
df_standard = fbref.read_player_season_stats(stat_type="standard")

# Method B — BeautifulSoup (all other leagues)
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time

url = "https://fbref.com/en/comps/9/2023-2024/stats/players/2023-2024-Premier-League-Stats"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
resp = requests.get(url, headers=headers)
tables = pd.read_html(resp.text, header=[0, 1])
df = tables[0]
time.sleep(4)  # ← CRITICAL: always wait between requests
```

---

### Source 2 — Transfermarkt (Kaggle CSV + Live Scraping)
> Market values, transfer history, player profiles

| Attribute | Value |
|---|---|
| Kaggle dataset | `dcariboo/player-scores` |
| GitHub (auto-updated) | https://github.com/dcaribou/transfermarkt-datasets |
| Direct CSV URL | `https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz` |
| Method | Direct `pd.read_csv()` — no scraping needed for baseline |
| Live rumors | BeautifulSoup scraping of transfermarkt.com |

**How to load Transfermarkt data:**
```python
import pandas as pd

# Load directly from URL (no download needed)
players = pd.read_csv(
    "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz"
)
valuations = pd.read_csv(
    "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/player_valuations.csv.gz"
)

# Or load from your local Kaggle download
players = pd.read_csv("data/players.csv")
```

---

## 📂 Dataset Reference

All CSV files come from the **Transfermarkt Kaggle dataset** (`dcariboo/player-scores`).

### `players.csv` — 47,702 rows × 26 columns
Core player identity and profile information.

| Column | Type | Description |
|---|---|---|
| `player_id` | int | Unique player identifier (join key) |
| `name` | str | Full player name |
| `first_name` | str | First name |
| `last_name` | str | Last name |
| `date_of_birth` | date | Birth date (used to compute age) |
| `country_of_birth` | str | Country born in |
| `country_of_citizenship` | str | Nationality |
| `position` | str | Main position (Attack / Midfield / Defender / Goalkeeper) |
| `sub_position` | str | Specific role (Centre-Forward, Attacking Midfield, etc.) |
| `foot` | str | Preferred foot (left / right / both) |
| `height_in_cm` | int | Height in centimeters |
| `current_club_id` | int | FK → clubs.club_id |
| `current_club_name` | str | Club name (denormalized) |
| `current_club_domestic_competition_id` | str | FK → competitions.competition_id |
| `market_value_in_eur` | float | Current market value in euros |
| `highest_market_value_in_eur` | float | Peak market value ever reached |
| `contract_expiration_date` | date | Contract end date |
| `agent_name` | str | Player agent |
| `international_caps` | int | National team appearances |
| `international_goals` | int | National team goals |
| `last_season` | int | Last season active |

---

### `player_valuations.csv` — 616,377 rows × 6 columns
Full market value history for every player over time.

| Column | Type | Description |
|---|---|---|
| `player_id` | int | FK → players.player_id |
| `date` | date | Date of valuation update |
| `market_value_in_eur` | float | Market value at that date |
| `current_club_name` | str | Club at time of valuation |
| `current_club_id` | int | FK → clubs.club_id |
| `player_club_domestic_competition_id` | str | FK → competitions.competition_id |

> **Use case:** Build a time-series chart of player value evolution. Detect rising stars (value growing fast) and fading players (value declining).

---

### `transfers.csv` — 157,186 rows × 10 columns
Full transfer history for every player.

| Column | Type | Description |
|---|---|---|
| `player_id` | int | FK → players.player_id |
| `player_name` | str | Player name (denormalized) |
| `transfer_date` | date | Date of transfer |
| `transfer_season` | str | Season (e.g., "23/24") |
| `from_club_id` | int | Origin club |
| `from_club_name` | str | Origin club name |
| `to_club_id` | int | Destination club |
| `to_club_name` | str | Destination club name |
| `transfer_fee` | float | Transfer fee paid in euros (0 = free / loan) |
| `market_value_in_eur` | float | Market value at time of transfer |

> **Use case:** Detect undervalued signings (transfer_fee << market_value_in_eur). Count transfers per player as a mobility signal.

---

### `appearances.csv` — 1,862,208 rows × 13 columns
One row per player per match played.

| Column | Type | Description |
|---|---|---|
| `appearance_id` | str | Unique ID |
| `game_id` | int | FK → games.game_id |
| `player_id` | int | FK → players.player_id |
| `player_club_id` | int | Club at time of match |
| `player_current_club_id` | int | Current club (may differ) |
| `date` | date | Match date |
| `player_name` | str | Player name |
| `competition_id` | str | FK → competitions.competition_id |
| `yellow_cards` | int | 0 or 1 |
| `red_cards` | int | 0 or 1 |
| `goals` | int | Goals scored in this match |
| `assists` | int | Assists in this match |
| `minutes_played` | int | Minutes on the pitch |

> **Use case:** Compute career totals, per-90 stats, recent form (last 12 months), and consistency metrics.

---

### `games.csv` — 86,983 rows × 23 columns
One row per match.

| Column | Type | Description |
|---|---|---|
| `game_id` | int | Unique match ID |
| `competition_id` | str | FK → competitions.competition_id |
| `season` | int | Season year |
| `date` | date | Match date |
| `home_club_id` / `away_club_id` | int | Club IDs |
| `home_club_goals` / `away_club_goals` | int | Final score |
| `home_club_formation` / `away_club_formation` | str | Tactical formation used |
| `stadium` | str | Venue name |
| `attendance` | int | Fan attendance |
| `referee` | str | Match referee |

---

### `game_events.csv` — 1,242,945 rows × 11 columns
Minute-level events per match (goals, substitutions, cards).

| Column | Type | Description |
|---|---|---|
| `game_event_id` | str | Unique event ID |
| `game_id` | int | FK → games.game_id |
| `minute` | int | Minute of the event |
| `type` | str | Event type: Goals, Substitutions, Cards |
| `player_id` | int | Player who caused the event |
| `player_in_id` | int | Player who came on (substitutions only) |
| `player_assist_id` | int | Assisting player (goals only) |
| `description` | str | Event description |

---

### `game_lineups.csv` — 3,049,833 rows × 10 columns
Starting XI and substitutes for every match.

| Column | Type | Description |
|---|---|---|
| `game_lineups_id` | str | Unique lineup entry ID |
| `game_id` | int | FK → games.game_id |
| `player_id` | int | FK → players.player_id |
| `club_id` | int | Club in this match |
| `type` | str | "starting_lineup" or "substitutes" |
| `position` | str | Position played in this match |
| `number` | int | Jersey number |
| `team_captain` | bool | Captain flag |

---

### `clubs.csv` — 796 rows × 17 columns
Club metadata.

| Column | Type | Description |
|---|---|---|
| `club_id` | int | Unique club ID |
| `name` | str | Club name |
| `domestic_competition_id` | str | FK → competitions.competition_id |
| `total_market_value` | float | Squad total value in euros |
| `squad_size` | int | Number of players |
| `average_age` | float | Squad average age |
| `foreigners_number` | int | Number of foreign players |
| `stadium_name` | str | Home stadium |
| `stadium_seats` | int | Stadium capacity |
| `net_transfer_record` | str | Net spend on transfers |
| `coach_name` | str | Current manager |

---

### `competitions.csv` — 67 rows × 11 columns
League and cup competition metadata.

| Column | Type | Description |
|---|---|---|
| `competition_id` | str | Unique competition code (e.g., "GB1", "ES1") |
| `name` | str | Competition name |
| `sub_type` | str | "first_tier", "domestic_cup", etc. |
| `type` | str | "domestic_league", "international_cup", etc. |
| `country_name` | str | Country of competition |
| `confederation` | str | UEFA, CONMEBOL, AFC, etc. |
| `total_clubs` | int | Number of clubs in competition |

---

### `club_games.csv` — 173,966 rows × 11 columns
Club-level match results (win/loss from each club's perspective).

| Column | Type | Description |
|---|---|---|
| `game_id` | int | FK → games.game_id |
| `club_id` | int | FK → clubs.club_id |
| `own_goals` | int | Goals scored by this club |
| `opponent_goals` | int | Goals conceded |
| `own_position` | int | League position at time of match |
| `is_win` | bool | True if this club won |
| `hosting` | str | "Home" or "Away" |

---

### `national_teams.csv` — 118 rows × 17 columns
National team metadata.

| Column | Type | Description |
|---|---|---|
| `national_team_id` | int | Unique national team ID |
| `name` | str | Country team name |
| `confederation` | str | FIFA confederation |
| `fifa_ranking` | int | Current FIFA ranking |
| `squad_size` | int | Number of players |
| `total_market_value` | float | Squad total market value |
| `average_age` | float | Squad average age |
| `coach_name` | str | Current national team coach |

---

### `countries.csv` — 118 rows × 8 columns

| Column | Type | Description |
|---|---|---|
| `country_id` | int | Unique country ID |
| `country_name` | str | Country name |
| `country_code` | str | ISO country code |
| `confederation` | str | FIFA confederation |
| `total_clubs` | int | Clubs in Transfermarkt database |
| `total_players` | int | Players registered |
| `average_age` | float | Average player age |

---

## 🔗 Entity Relationship Diagram

```
players ──────────────── player_id ──── appearances ──── game_id ──── games
   │                                         │                          │
   │                                    competition_id              competition_id
   │                                         │                          │
   ├── player_id ──── transfers          competitions ◄───────────────┘
   │
   ├── player_id ──── player_valuations
   │
   ├── current_club_id ──── clubs ──── domestic_competition_id ──── competitions
   │
   ├── current_national_team_id ──── national_teams
   │
   └── player_id ──── game_lineups ──── game_id ──── games
                                             │
                                        club_id ──── club_games
```

---

## 🤖 AI Models

### Model 1 — Player Similarity Engine
```
Algorithm:    KNN (K-Nearest Neighbors) + Cosine Similarity
Input:        Reference player name
Output:       Top 10 most similar players (with similarity %)
Features:     Per-90 stats vector (goals, assists, xG, xA, tackles,
              pressures, progressive passes, dribbles, aerials won)
Library:      scikit-learn (NearestNeighbors)
```

### Model 2 — Talent Scoring
```
Algorithm:    XGBoost Classifier / Regressor
Input:        Full player feature vector (stats + age + league + value)
Output:       Talent score 0–100
Target:       Binary label based on career value evolution
              (did this player's value grow significantly?)
Library:      xgboost, scikit-learn
Evaluation:   Cross-validation, ROC-AUC, feature importance (SHAP)
```

### Model 3 — Play Style Clustering
```
Algorithm:    K-Means + PCA for visualization
Input:        Positional stat subset (different features per position)
Output:       Style cluster label per player
              Examples: "Box-to-Box", "Deep Playmaker", "Pressing Machine"
              for midfielders
Library:      scikit-learn (KMeans, PCA)
Visualization: t-SNE / PCA scatter plot per position
```

### Recommendation Engine
```
Pipeline:     1. Filter by position + age + budget
              2. Filter by style cluster (Model 3)
              3. Rank by talent score (Model 2)
              4. Sort by value efficiency (G+A / €M)
              5. Return top 5 with similarity to reference (Model 1)
Output:       Player cards + exportable PDF scouting report
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Data scraping** | Python, Requests, BeautifulSoup | FBref scraping |
| **FBref (Big 5)** | soccerdata | Clean FBref API wrapper |
| **Data processing** | Pandas, NumPy | Cleaning, feature engineering |
| **AI models** | Scikit-learn, XGBoost | KNN, K-Means, XGBoost |
| **Explainability** | SHAP | Feature importance visualization |
| **Visualization** | Matplotlib, Plotly, Seaborn | EDA + cluster plots |
| **Backend API** | FastAPI (Python) | Serve model predictions |
| **BI Dashboards** | Power BI / Tableau / Plotly Dash | Interactive reports |
| **Frontend** | React + TypeScript | Web application UI |
| **PDF Export** | WeasyPrint / ReportLab | Scouting report generation |
| **Database** | PostgreSQL / SQLite | Persistent storage |
| **Scheduler** | Cron / Apache Airflow | Weekly data refresh |
| **Version control** | GitHub | Collaboration + CI |
| **Project mgmt** | Notion / Jira | Task tracking |

---

## 📁 Project Structure

```
scoutiq/
│
├── data/                          # All CSV datasets
│   ├── raw/                       # Original Kaggle CSVs (do not modify)
│   │   ├── players.csv            # 47,702 rows
│   │   ├── player_valuations.csv  # 616,377 rows
│   │   ├── transfers.csv          # 157,186 rows
│   │   ├── appearances.csv        # 1,862,208 rows
│   │   ├── games.csv              # 86,983 rows
│   │   ├── game_events.csv        # 1,242,945 rows
│   │   ├── game_lineups.csv       # 3,049,833 rows
│   │   ├── clubs.csv              # 796 rows
│   │   ├── competitions.csv       # 67 rows
│   │   ├── club_games.csv         # 173,966 rows
│   │   ├── national_teams.csv     # 118 rows
│   │   └── countries.csv         # 118 rows
│   ├── scraped/                   # FBref scraped data
│   │   ├── fbref_standard.csv
│   │   ├── fbref_shooting.csv
│   │   ├── fbref_passing.csv
│   │   ├── fbref_defense.csv
│   │   ├── fbref_possession.csv
│   │   └── fbref_misc.csv
│   └── processed/                 # Cleaned and merged outputs
│       └── master_scouting_dataset.csv
│
├── notebooks/                     # Jupyter notebooks (exploration + modeling)
│   ├── 01_data_exploration.ipynb
│   ├── 02_fbref_scraping.ipynb
│   ├── 03_feature_engineering.ipynb
│   ├── 04_model_similarity.ipynb
│   ├── 05_model_talent_score.ipynb
│   ├── 06_model_clustering.ipynb
│   └── 07_recommendation_engine.ipynb
│
├── src/                           # Source code
│   ├── data/
│   │   ├── scraper_fbref.py       # FBref scraping logic
│   │   ├── scraper_transfermarkt.py
│   │   ├── pipeline.py            # Full data pipeline
│   │   └── feature_engineering.py
│   ├── models/
│   │   ├── similarity.py          # KNN similarity model
│   │   ├── talent_score.py        # XGBoost scoring model
│   │   ├── clustering.py          # K-Means style clustering
│   │   └── recommender.py         # Recommendation engine
│   └── api/
│       ├── main.py                # FastAPI app entry point
│       ├── routes/
│       │   ├── players.py         # /players endpoints
│       │   ├── similarity.py      # /similarity endpoint
│       │   ├── recommend.py       # /recommend endpoint
│       │   └── report.py          # /report/pdf endpoint
│       └── schemas.py             # Pydantic models
│
├── dashboard/                     # BI dashboards
│   ├── power_bi/
│   │   └── scouting_dashboard.pbix
│   └── plotly_dash/
│       └── app.py
│
├── frontend/                      # React application (future)
│   ├── src/
│   └── package.json
│
├── reports/                       # Generated scouting PDF reports
│
├── requirements.txt               # Python dependencies
├── .env.example                   # Environment variables template
├── .gitignore
└── README.md                      # This file
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- Git
- Node.js 18+ (for frontend only)
- 4GB+ RAM (for large dataset processing)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/scoutiq.git
cd scoutiq
```

### 2. Create a virtual environment
```bash
python -m venv venv

# Activate on Windows
venv\Scripts\activate

# Activate on macOS/Linux
source venv/bin/activate
```

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 4. Download the Kaggle datasets
```bash
# Option A — Kaggle CLI
pip install kaggle
kaggle datasets download davidcariboo/player-scores -p data/raw/ --unzip

# Option B — Manual download
# Go to: https://www.kaggle.com/datasets/davidcariboo/player-scores
# Download and extract all CSVs into data/raw/
```

### 5. Verify the data
```bash
python notebooks/01_data_exploration.ipynb
```

### `requirements.txt`
```
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
xgboost>=1.7.0
shap>=0.42.0
matplotlib>=3.7.0
seaborn>=0.12.0
plotly>=5.15.0
requests>=2.31.0
beautifulsoup4>=4.12.0
lxml>=4.9.0
tqdm>=4.65.0
soccerdata>=0.3.0
fastapi>=0.100.0
uvicorn>=0.23.0
python-dotenv>=1.0.0
reportlab>=4.0.0
jupyter>=1.0.0
ipykernel>=6.25.0
```

---

## 🔄 Data Pipeline

### Full pipeline execution order:
```bash
# Step 1 — Explore raw Kaggle data
jupyter notebook notebooks/01_data_exploration.ipynb

# Step 2 — Scrape FBref (takes 15–25 minutes, 32 leagues × 6 stat types)
python src/data/scraper_fbref.py

# Step 3 — Clean, merge, and engineer features
python src/data/pipeline.py

# Step 4 — Output: data/processed/master_scouting_dataset.csv
```

### Key computed columns in master dataset:

| Column | Formula | Purpose |
|---|---|---|
| `age` | `(today - date_of_birth) / 365.25` | Player's current age |
| `goals_p90` | `goals / (minutes_played / 90)` | Goals per 90 minutes |
| `assists_p90` | `assists / (minutes_played / 90)` | Assists per 90 minutes |
| `xG_p90` | `xG / (minutes_played / 90)` | Expected goals per 90 |
| `xA_p90` | `xA / (minutes_played / 90)` | Expected assists per 90 |
| `tackles_p90` | `tackles / (minutes_played / 90)` | Tackles per 90 |
| `pressures_p90` | `pressures / (minutes_played / 90)` | Pressures per 90 |
| `value_efficiency` | `(goals + assists) / (market_value / 1M)` | Output per million € |
| `career_goals_p90` | `career_goals / (career_minutes / 90)` | Career average |
| `last12m_goals` | Sum of goals in last 12 months | Current form signal |
| `peak_market_value_eur` | Max of all valuations | Historical peak |

---

## 🌍 League Coverage

### Big 5 European (via soccerdata — cleanest data)
| ID | League | Country |
|---|---|---|
| GB1 | Premier League | England |
| ES1 | La Liga | Spain |
| L1 | Bundesliga | Germany |
| IT1 | Serie A | Italy |
| FR1 | Ligue 1 | France |

### Other European Leagues (direct FBref scraping)
| ID | League | Country |
|---|---|---|
| NL1 | Eredivisie | Netherlands |
| PO1 | Primeira Liga | Portugal |
| BE1 | Pro League | Belgium |
| TR1 | Süper Lig | Turkey |
| SC1 | Scottish Premiership | Scotland |
| GR1 | Super League | Greece |
| SE1 | Allsvenskan | Sweden |
| NO1 | Eliteserien | Norway |
| DK1 | Superliga | Denmark |
| PL1 | Ekstraklasa | Poland |
| A1 | Bundesliga | Austria |
| C1 | Super League | Switzerland |
| RU1 | Premier League | Russia |
| TS1 | First League | Czech Republic |
| RO1 | Liga I | Romania |
| SER1 | SuperLiga | Serbia |
| KR1 | HNL | Croatia |
| UKR1 | Premier League | Ukraine |

### Americas
| ID | League | Country |
|---|---|---|
| MLS1 | Major League Soccer | USA |
| BRA1 | Brasileirão Serie A | Brazil |
| ARG1 | Liga Profesional | Argentina |
| MEX1 | Liga MX | Mexico |
| COL1 | Liga BetPlay | Colombia |

### Asia & Pacific
| ID | League | Country |
|---|---|---|
| JAP1 | J1 League | Japan |
| RSK1 | K League 1 | South Korea |
| AUS1 | A-League Men | Australia |
| SA1 | Saudi Pro League | Saudi Arabia |

---

## 👥 Target Users

| User Type | Pain Point | How ScoutiKoora Helps |
|---|---|---|
| **Freelance scouts** | Miss talent in non-top leagues | 32+ leagues covered, AI similarity search |
| **Football clubs (div 2/3)** | Limited scouting budget | 10× cheaper than Wyscout, data-driven |
| **Player agents** | Hard to find undervalued rising talent | Value efficiency metric + trend alerts |
| **Football analysts** | Manual data aggregation | Ready-to-use BI dashboards |
| **Football fans** | Want deep stats beyond TV | Free tier with basic discovery |
| **Youth academies** | Track player development vs peers | Progression curves + position benchmarks |

---

## 📅 Roadmap

### Phase 1 — Setup + Exploration (Week 1–2) ← *We are here*
- [x] Project structure initialized
- [x] Kaggle datasets downloaded and mapped
- [x] Dataset documentation (this README)
- [ ] Jupyter notebook: data exploration + EDA
- [ ] GitHub repository setup
- [ ] Notion/Jira board configured

### Phase 2 — Data Pipeline (Week 3)
- [ ] FBref scraper for all 32+ leagues
- [ ] Data cleaning and normalization
- [ ] Feature engineering (per-90 KPIs)
- [ ] master_scouting_dataset.csv ready

### Phase 3 — AI Models (Week 4–6)
- [ ] Model 1: KNN similarity engine
- [ ] Model 2: XGBoost talent scoring
- [ ] Model 3: K-Means style clustering
- [ ] Model evaluation and SHAP explainability

### Phase 4 — Recommendation Engine + API (Week 7)
- [ ] Pipeline combining all 3 models
- [ ] FastAPI backend
- [ ] PDF scouting report export

### Phase 5 — Dashboards + Frontend (Week 8)
- [ ] Power BI / Plotly Dash dashboards
- [ ] Radar charts, world map, leaderboard
- [ ] Player profile pages

### Phase 6 — Integration + Polish (Week 9–10)
- [ ] End-to-end testing
- [ ] Demo video recording
- [ ] Professor presentation slides
- [ ] Final report writing

---

## 👨‍💻 Team

| Member | Role | Responsibilities |
|---|---|---|
| **Member 1** | AI / Data Science Lead | Data pipeline · FBref scraper · All 3 ML models · FastAPI backend |
| **Member 2** | BI / Frontend Lead | BI dashboards · React frontend · PDF reports · Presentation |

**Supervisor:** Sawssen JALEL  
**Module:** Projet AI & BI  
**Year:** Engineering 4th year — 2024/2025

---

## 📜 Data Attribution

- **Transfermarkt data** sourced from [dcaribou/transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) via Kaggle — updated weekly
- **FBref statistics** scraped from [fbref.com](https://fbref.com) — powered by Sports Reference
- All data used strictly for academic research purposes

---

*ScoutiKoora — Find the next Mbappe before anyone else does.*