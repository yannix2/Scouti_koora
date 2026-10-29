"""
Player Data Service — ports 8001
Owns: player_snapshot.csv — player profiles, search, compare, styles, recommend, hidden-gems
"""
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import pickle, json, pandas as pd, numpy as np
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"

app = FastAPI(title="Player Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

snapshot: pd.DataFrame = pd.DataFrame()
latest: pd.DataFrame = pd.DataFrame()


@app.on_event("startup")
def load_data():
    global snapshot, latest
    snapshot = pd.read_csv(PROCESSED / "player_snapshot.csv", low_memory=False)

    clusters = pd.read_csv(PROCESSED / "style_clusters.csv", low_memory=False)
    talent = pd.read_csv(PROCESSED / "talent_scores.csv", low_memory=False)

    if "style_label" not in snapshot.columns and "style_label" in clusters.columns:
        snapshot = snapshot.merge(
            clusters[["Player", "season", "style_label", "cluster_id", "position_group"]].drop_duplicates(),
            on=["Player", "season"], how="left"
        )
    if "predicted_talent" not in snapshot.columns and "predicted_talent" in talent.columns:
        snapshot = snapshot.merge(
            talent[["Player", "season", "predicted_talent", "talent_label"]].drop_duplicates(),
            on=["Player", "season"], how="left"
        )

    latest = (
        snapshot.sort_values("season", ascending=False)
        .drop_duplicates("Player", keep="first")
        .reset_index(drop=True)
    )


def norm(name):
    if not name: return ""
    n = unicodedata.normalize("NFD", str(name))
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    return n.lower().strip()


def safe_json(df):
    return json.loads(df.to_json(orient="records", default_handler=str))


@app.get("/health")
def health():
    return {"status": "ok", "players": len(latest), "style_labels": sorted(latest["style_label"].dropna().unique().tolist())}


@app.get("/players")
def search_players(q: str = Query(..., min_length=2), top_n: int = 10):
    results = latest[latest["Player"].apply(norm).str.contains(norm(q), na=False)]
    out_cols = ["Player", "primary_pos", "Squad", "league", "Age", "market_value_eur", "predicted_talent"]
    out_cols = [c for c in out_cols if c in results.columns]
    return safe_json(results[out_cols].head(top_n))


@app.get("/players/{name}")
def player_profile(name: str):
    row = latest[latest["Player"].apply(norm) == norm(name)]
    if row.empty:
        row = latest[latest["Player"].apply(norm).str.contains(norm(name), na=False)]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"Player not found: {name}")
    return safe_json(row.head(1))[0]


@app.get("/styles")
def get_styles():
    if "style_label" not in latest.columns:
        return []
    return sorted(latest["style_label"].dropna().unique().tolist())


@app.get("/compare")
def compare(player_a: str = Query(...), player_b: str = Query(...)):
    def get_player(name):
        r = latest[latest["Player"].apply(norm) == norm(name)]
        if r.empty:
            r = latest[latest["Player"].apply(norm).str.contains(norm(name), na=False)]
        if r.empty:
            raise HTTPException(404, f"Not found: {name}")
        return r.iloc[0]

    pa, pb = get_player(player_a), get_player(player_b)
    cols = ["Player", "primary_pos", "Squad", "league", "Age",
            "goals_p90", "assists_p90", "g_a_p90", "shots_p90",
            "shot_accuracy_pct", "tackles_won_p90", "interceptions_p90",
            "def_actions_p90", "availability_pct",
            "market_value_eur", "predicted_talent", "style_label"]
    cols = [c for c in cols if c in latest.columns]
    return safe_json(pd.DataFrame([pa[cols], pb[cols]]))


@app.get("/recommend")
def recommend_players(
    position: Optional[str] = None,
    style: Optional[str] = None,
    max_budget_eur: Optional[float] = None,
    max_age: Optional[int] = None,
    min_age: Optional[int] = None,
    leagues: Optional[str] = None,
    min_minutes: int = 500,
    reference_player: Optional[str] = None,
    top_n: int = 10,
):
    pool = latest.copy()
    pos_map = {"forward": "pos_FW", "midfielder": "pos_MF", "defender": "pos_DF", "goalkeeper": "pos_GK"}

    if position:
        col = pos_map.get(position.lower())
        if col and col in pool.columns:
            pool = pool[pool[col] == 1]
    if min_minutes:
        pool = pool[pd.to_numeric(pool.get("minutes_played", 0), errors="coerce").fillna(0) >= min_minutes]
    if max_age:
        pool = pool[pd.to_numeric(pool["Age"], errors="coerce").fillna(99) <= max_age]
    if min_age:
        pool = pool[pd.to_numeric(pool["Age"], errors="coerce").fillna(0) >= min_age]
    if max_budget_eur:
        mv = pd.to_numeric(pool["market_value_eur"], errors="coerce")
        pool = pool[mv.isna() | (mv <= max_budget_eur)]
    if leagues:
        lg_list = [l.strip() for l in leagues.split(",")]
        pool = pool[pool["league"].isin(lg_list)]
    if style and "style_label" in pool.columns:
        pool = pool[pool["style_label"] == style]

    if pool.empty:
        return []

    score_col = "predicted_talent" if "predicted_talent" in pool.columns else "overall_score"
    pool = pool.sort_values(score_col, ascending=False)

    out_cols = ["Player", "primary_pos", "Squad", "league", "season", "Age",
                "style_label", "predicted_talent", "talent_label",
                "market_value_eur", "goals_p90", "assists_p90",
                "tackles_won_p90", "availability_pct"]
    out_cols = [c for c in out_cols if c in pool.columns]
    return safe_json(pool[out_cols].head(top_n))


@app.get("/hidden-gems")
def hidden_gems(
    position: Optional[str] = None,
    max_value_eur: float = 20_000_000,
    min_talent_score: float = 60,
    max_age: int = 26,
    top_n: int = 20,
):
    pool = latest.copy()
    score_col = "predicted_talent" if "predicted_talent" in pool.columns else "overall_score"
    pos_map = {"forward": "pos_FW", "midfielder": "pos_MF", "defender": "pos_DF", "goalkeeper": "pos_GK"}

    if position:
        col = pos_map.get(position.lower())
        if col and col in pool.columns:
            pool = pool[pool[col] == 1]

    mv = pd.to_numeric(pool["market_value_eur"], errors="coerce")
    ts = pd.to_numeric(pool[score_col], errors="coerce")
    age = pd.to_numeric(pool["Age"], errors="coerce")
    pool = pool[(mv <= max_value_eur) & (ts >= min_talent_score) & (age <= max_age)]
    pool = pool.sort_values(score_col, ascending=False)

    out_cols = ["Player", "primary_pos", "Squad", "league", "season", "Age",
                "style_label", score_col, "market_value_eur",
                "goals_p90", "assists_p90", "tackles_won_p90"]
    out_cols = [c for c in out_cols if c in pool.columns]
    return safe_json(pool[out_cols].head(top_n))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
