# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Next.js (user's choice). The frontend is a separate app talking to the existing FastAPI gateway (`src/api/main.py`, :8000); it never calls the player/similarity microservices directly. Runs locally (localhost:3000) for now; no deploy target yet. Must scale to more screens and leagues without rework.

## Users

- **Freelance scouts**: individuals hunting talent on a budget, who need fast candidate discovery and a defensible shortlist.
- **Player agents**: looking for undervalued or rising players to represent or place.
- **Lower-division club recruitment staff (div 2/3)**: limited budget and staff; need data-driven shortlists instead of spreadsheets.

Account roles in the backend: `scout`, `agent`, `club`.

## Product Purpose

ScoutiKoora ("koora" = football in Arabic) is an AI scouting tool. It turns per-90 stats, market values and injury history into decisions:
- who plays like player X;
- who fits a position, budget, age and style brief;
- who is undervalued;
- how two players compare;
- what a structured scouting verdict says.

Success means a user reaches a defensible shortlist quickly and keeps their work (saved players, lists) in the product.

## Positioning

Explainable ML scouting at a fraction of enterprise-tool cost. Three models work together:
- KNN cosine similarity: "plays like".
- An XGBoost talent score from 0 to 100.
- K-Means play-style labels per position.

Hybrid personal recommendations are built on top of them. Every number traces to visible stats rather than a black-box rating.

## Operating Context

The user searches a name, opens a player report and checks the radar, strengths and weaknesses, value and injury risk. From there they jump to similar players or compare, then save to a scouting list. Discovery also starts from filters, such as position, style, budget, age and leagues, or from hidden gems. Logged-in users get personalized recommendations from their view and save history, plus trending players.

## Capabilities and Constraints

- **Data:** 4,817 players. **Big 5 leagues only:** EPL, LaLiga, SerieA, Bundesliga, Ligue1. Seasons 2020-21 to 2024-25. The UI shows the most recent season per player.
- **Play-style labels (12):** Aggressive Stopper, Backup GK, Box-to-Box, Complete Forward, Creative #10, Deep Playmaker, Defensive CB, Defensive Midfielder, Pure Poacher, Shot-stopper, Target Man, Wide Forward.
- **API:** see the endpoint table in `AGENTS.md`. Auth uses JWT access and refresh tokens. The `/scouting/*` and `/recommendations/*` routes require auth; search, report, radar, similar, recommend, hidden-gems and compare are public.
- **Gateway field renaming:** it renames some fields, e.g. `Position`, `League`, `"Market Value"` (a preformatted € string) and `"Talent Score"`. `/players/{name}`, `/radar`, `/report` and `/compare` return their own shapes.
- **Not available:** player photos and club crests. Do not imply that they exist.
- **Languages:** English, French and Arabic, with Arabic fully RTL.

## Brand Commitments

Name: ScoutiKoora. Football- and scouting-themed. The user asked for a "smart, modern, smooth" feel.

## Evidence on Hand

- Real model outputs: `data/processed/*.csv`, `*.pkl`.
- Evaluation plots: `reports/*.png` (SHAP, feature importance, clusters, radar).
- **Absences:** no customers, testimonials, pricing or deployed users. The README's "32+ leagues" and "€49/month" are plans, not facts. Do not claim them.

## Product Principles

1. **Show the why.** Every score sits next to the stats that produced it.
2. **Shortlist is the outcome.** Every discovery surface leads to save, compare or "similar" in one step.
3. **Honest data.** State coverage (Big 5, seasons) and missing values plainly. Never pad.
4. **Built for fast scanning.** Scouts compare many players quickly, so density and consistency matter more than decoration.

## Accessibility & Inclusion

Must work fully in Arabic RTL as well as LTR English and French. Charts and radar need text equivalents for their values.
