"""
ScoutiKoora API Gateway — port 8000
Thin proxy: auth handled locally, data/SDL routed to microservices.
"""
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from httpx import AsyncClient, HTTPStatusError
from src.auth.router import router as auth_router
from src.api.routes.scouting import router as scouting_router
from src.api.routes.recommendations import router as recommendations_router
import os, math, urllib.parse

PLAYER_SERVICE = os.getenv("PLAYER_SERVICE", "http://127.0.0.1:8001")
SIMILARITY_SERVICE = os.getenv("SIMILARITY_SERVICE", "http://127.0.0.1:8002")

app = FastAPI(title="ScoutiKoora API Gateway", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)
app.include_router(scouting_router)
app.include_router(recommendations_router)

client = AsyncClient(timeout=15)


@app.on_event("shutdown")
async def shutdown():
    await client.aclose()


async def _proxy(url: str, params: dict = None):
    resp = await client.get(url, params=params)
    resp.raise_for_status()
    return resp.json()


# ─── Field mapping ────────────────────────────────────────────────────
# Player service returns primary_pos, league, market_value_eur, predicted_talent
# Frontend expects Position, League, "Market Value", "Talent Score"

def _map_player(d: dict) -> dict:
    """Add display-named fields for the frontend; raw fields are kept so clients can format/sort them."""
    out = dict(d)
    if "primary_pos" in out:
        out["Position"] = out.pop("primary_pos")
    if "league" in out and "League" not in out:
        out["League"] = out.pop("league")
    if "market_value_eur" in out and "Market Value" not in out:
        mv = out["market_value_eur"]
        out["Market Value"] = f"€{float(mv):,.0f}" if mv and str(mv).replace('.', '', 1).lstrip('-').isdigit() else str(mv or "N/A")
    if "predicted_talent" in out and "Talent Score" not in out:
        out["Talent Score"] = out["predicted_talent"]
    if "similarity_pct" in out:
        out["similarity_pct"] = round(float(out["similarity_pct"]), 1)
    return out


def _map_players(items: list) -> list:
    return [_map_player(i) for i in items]


# ─── Health ────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    statuses = {}
    for name, url in [("player", PLAYER_SERVICE), ("similarity", SIMILARITY_SERVICE)]:
        try:
            r = await client.get(f"{url}/health", timeout=5)
            statuses[name] = "ok" if r.status_code == 200 else "error"
        except Exception:
            statuses[name] = "unreachable"
    return {"gateway": "ok", "services": statuses}


# ─── Player Search / Profile / Compare ────────────────────────────
@app.get("/players")
async def search_players(q: str = Query(..., min_length=2), top_n: int = 10):
    try:
        data = await _proxy(f"{PLAYER_SERVICE}/players", {"q": q, "top_n": top_n})
        return _map_players(data)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")


@app.get("/players/{name}")
async def player_profile(name: str):
    try:
        data = await _proxy(f"{PLAYER_SERVICE}/players/{urllib.parse.quote(name)}")
        return _map_player(data)
    except HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(404, f"Player not found: {name}")
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")


@app.get("/similar/{player_name}")
async def similar_players(player_name: str, top_n: int = 10, same_position: bool = True):
    try:
        data = await _proxy(
            f"{SIMILARITY_SERVICE}/similar/{urllib.parse.quote(player_name)}",
            {"top_n": top_n, "same_position": str(same_position).lower()},
        )
        return _map_players(data)
    except HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(404, f"Player not found: {player_name}")
        raise HTTPException(status_code=e.response.status_code, detail="Similarity service error")


@app.get("/recommend")
async def recommend_players(
    position: Optional[str] = None,
    style: Optional[str] = None,
    max_budget_eur: Optional[float] = None,
    max_age: Optional[int] = None,
    min_age: Optional[int] = None,
    leagues: Optional[str] = None,
    min_minutes: int = 500,
    top_n: int = 10,
):
    params = {k: v for k, v in locals().items() if v is not None and k != "reference_player"}
    try:
        data = await _proxy(f"{PLAYER_SERVICE}/recommend", params)
        return _map_players(data)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")


@app.get("/hidden-gems")
async def hidden_gems(
    position: Optional[str] = None,
    max_value_eur: float = 20_000_000,
    min_talent_score: float = 60,
    max_age: int = 26,
    top_n: int = 20,
):
    params = {k: v for k, v in locals().items() if v is not None}
    try:
        data = await _proxy(f"{PLAYER_SERVICE}/hidden-gems", params)
        return _map_players(data)
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")


@app.get("/compare")
async def compare(player_a: str = Query(...), player_b: str = Query(...)):
    try:
        data = await _proxy(f"{PLAYER_SERVICE}/compare", {"player_a": player_a, "player_b": player_b})
        pa, pb = _map_player(data[0]), _map_player(data[1]) if len(data) >= 2 else ({}, {})
        differences = {}
        all_keys = set(pa.keys()) | set(pb.keys())
        for key in all_keys:
            if key in ("Player", "Position", "Squad"):
                continue
            va, vb = pa.get(key), pb.get(key)
            if va != vb:
                try:
                    differences[key] = float(va) - float(vb) if va is not None and vb is not None else 0
                except (ValueError, TypeError):
                    pass
        return {"player_a": pa, "player_b": pb, "differences": differences}
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")


@app.get("/styles")
async def get_styles():
    try:
        return await _proxy(f"{PLAYER_SERVICE}/styles")
    except HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")


# ─── Radar Chart Data ─────────────────────────────────────────────
# Score ceilings ≈ 99th percentile of the latest-season snapshot (4,817 players), so 100 = elite, not a theoretical max.
# conversion_rate and finishing_quality are 0-1 fractions; attack/defense/discipline/overall/talent_score are 0-10.
_STAT_MAXES = {
    "goals_p90": 0.8, "assists_p90": 0.55, "g_a_p90": 1.0,
    "shots_p90": 4.2, "shot_accuracy_pct": 100.0, "conversion_rate": 0.5,
    "finishing_quality": 1.0, "tackles_won_p90": 3.0, "interceptions_p90": 2.6,
    "def_actions_p90": 4.5, "yellow_p90": 1.0, "red_p90": 0.25,
    "availability_pct": 100.0, "games_played": 38, "minutes_played": 3420,
    "height_in_cm": 210, "market_value_eur": 200_000_000,
    "attack_score": 10.0, "defense_score": 10.0, "discipline_score": 10.0,
    "overall_score": 10.0, "talent_score": 10.0, "predicted_talent": 100.0,
    "form_goals_p90": 0.8, "career_goals_p90": 0.8, "career_g_a_p90": 1.0,
}
# value_efficiency = (G+A) per €1M of market value: median 0.2, p99 24, max 500, so it is scored on a log scale.
_VALUE_EFFICIENCY_P99 = 24.0


def _norm(raw, key):
    mx = _STAT_MAXES.get(key, 100.0)
    try:
        v = float(raw) if raw is not None else 0.0
    except (ValueError, TypeError):
        v = 0.0
    return max(0.0, min(100.0, v / mx * 100.0))


def _value_score(raw):
    try:
        v = max(0.0, float(raw)) if raw is not None else 0.0
    except (ValueError, TypeError):
        v = 0.0
    return min(100.0, math.log1p(v) / math.log1p(_VALUE_EFFICIENCY_P99) * 100.0)


def _inverse_norm(raw, key):
    return 100.0 - _norm(raw, key)


_RADAR_AXES = [
    ("Goals p90", "goals_p90"),
    ("Assists p90", "assists_p90"),
    ("Shots p90", "shots_p90"),
    ("Shot Accuracy", "shot_accuracy_pct"),
    ("Conversion Rate", "conversion_rate"),
    ("Tackles p90", "tackles_won_p90"),
    ("Interceptions p90", "interceptions_p90"),
    ("Def Actions p90", "def_actions_p90"),
    ("Availability", "availability_pct"),
    ("Discipline", "yellow_p90"),
]

_CATEGORIES = {
    "attack": {
        "label": "Attack",
        "icon": "sports_kabaddi",
        "metrics": ["goals_p90", "assists_p90", "shots_p90", "conversion_rate"],
    },
    "defense": {
        "label": "Defense",
        "icon": "shield",
        "metrics": ["tackles_won_p90", "interceptions_p90", "def_actions_p90"],
    },
    "physical": {
        "label": "Physical",
        "icon": "fitness_center",
        "metrics": ["availability_pct", "games_played"],
    },
    "discipline": {
        "label": "Discipline",
        "icon": "gavel",
        "metrics": ["yellow_p90", "red_p90"],
    },
    "technical": {
        "label": "Technical",
        "icon": "handyman",
        "metrics": ["shot_accuracy_pct", "conversion_rate", "finishing_quality"],
    },
}


def _compute_radar(p: dict) -> dict:
    axes = []
    for label, key in _RADAR_AXES:
        if key == "yellow_p90":
            val = _inverse_norm(p.get(key), key)
        else:
            val = _norm(p.get(key), key)
        axes.append({"label": label, "value": round(val, 1)})

    categories = {}
    for cid, cat in _CATEGORIES.items():
        vals = [_norm(p.get(m), m) for m in cat["metrics"] if m != "finishing_quality" or p.get(m)]
        if cid == "discipline":
            vals = [_inverse_norm(p.get(m), m) for m in cat["metrics"]]
        score = round(sum(vals) / len(vals), 1) if vals else 0
        categories[cid] = {
            "label": cat["label"],
            "icon": cat["icon"],
            "score": score,
        }
    return {"axes": axes, "categories": categories}


@app.get("/radar/{name}")
async def player_radar(name: str):
    try:
        profile = await _proxy(f"{PLAYER_SERVICE}/players/{urllib.parse.quote(name)}")
    except HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(404, f"Player not found: {name}")
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")
    return {"player": profile.get("Player", name), **_compute_radar(profile)}


# ─── Scouting Report ──────────────────────────────────────────────
def _compute_report(p: dict, radar: dict) -> dict:
    report = {"player": p.get("Player", ""), "position": p.get("primary_pos", "N/A")}

    # Strengths & Weaknesses from axes
    axes = radar.get("axes", [])
    sorted_axes = sorted(axes, key=lambda a: a["value"], reverse=True)
    report["strengths"] = [{"label": a["label"], "value": a["value"]} for a in sorted_axes[:3]]
    report["weaknesses"] = [{"label": a["label"], "value": a["value"]} for a in sorted_axes[-3:] if a["value"] < 50]

    # Value assessment
    mv = p.get("market_value_eur")
    peak = p.get("peak_value_eur") or mv
    value_trend = p.get("value_trend", 0)
    try:
        mv_f = float(mv) if mv else 0
        peak_f = float(peak) if peak else mv_f
    except (ValueError, TypeError):
        mv_f, peak_f = 0, 0
    pct_of_peak = (mv_f / peak_f * 100) if peak_f > 0 else 100

    report["value_assessment"] = {
        "market_value_eur": mv_f,
        "peak_value_eur": peak_f,
        "pct_of_peak": round(pct_of_peak, 1),
        "trend": "rising" if value_trend and float(value_trend) > 0 else "stable" if value_trend and float(value_trend) == 0 else "declining",
        "value_score": round(_value_score(p.get("value_efficiency")), 1),
    }

    # Injury risk: None/"unknown" when the snapshot has no risk score, instead of a fake 0/"low"
    try:
        ir = float(p.get("injury_risk_score"))
        ir = None if math.isnan(ir) else round(ir, 1)
    except (ValueError, TypeError):
        ir = None
    injuries = int(float(p.get("total_injuries") or 0))
    days_out = int(float(p.get("total_days_out") or 0))
    report["injury_risk"] = {
        "score": ir,
        "label": (p.get("injury_risk_label") or "unknown").lower() if ir is not None else "unknown",
        "total_injuries": injuries,
        "total_days_out": days_out if (days_out or not injuries) else None,
    }

    # Categories
    report["categories"] = radar.get("categories", {})

    # Player info — map fields
    info = {
        "age": p.get("Age"),
        "nation": p.get("Nation"),
        "squad": p.get("Squad"),
        "league": p.get("league"),
        "position": p.get("primary_pos"),
        "foot": p.get("foot"),
        "height": p.get("height_in_cm"),
    }
    report["info"] = info

    # Stats summary
    report["stats"] = {
        "goals_p90": round(float(p.get("goals_p90", 0)), 2) if p.get("goals_p90") else 0,
        "assists_p90": round(float(p.get("assists_p90", 0)), 2) if p.get("assists_p90") else 0,
        "tackles_won_p90": round(float(p.get("tackles_won_p90", 0)), 2) if p.get("tackles_won_p90") else 0,
        "interceptions_p90": round(float(p.get("interceptions_p90", 0)), 2) if p.get("interceptions_p90") else 0,
        "overall_score": round(float(p.get("overall_score", 0)), 1) if p.get("overall_score") else 0,
        # XGBoost talent score (0-100); the snapshot's `talent_score` column is a 0-10 composite, not the model output
        "talent_score": round(float(p.get("predicted_talent")), 1) if p.get("predicted_talent") is not None else None,
    }

    # Talent label
    report["profile"] = _position_profile(p.get("primary_pos", ""), report["categories"])
    try:
        report["minutes_played"] = int(float(p.get("minutes_played") or 0))
    except (ValueError, TypeError):
        report["minutes_played"] = 0

    report["talent_label"] = p.get("talent_label", "unrated")
    report["style_label"] = p.get("style_label", "unknown")
    report["overall_verdict"] = _get_verdict(report)
    return report


# Verdicts judge a player only on the categories that matter for their position, against same-position peers.
# Goalkeepers have no shot-stopping stats in the snapshot, so their profile is availability + discipline only.
_POSITION_WEIGHTS = {
    "Forward":    {"attack": 0.5, "technical": 0.3, "physical": 0.2},
    "Midfielder": {"attack": 0.3, "defense": 0.3, "technical": 0.2, "physical": 0.2},
    "Defender":   {"defense": 0.6, "physical": 0.3, "discipline": 0.1},
    "Goalkeeper": {"physical": 0.7, "discipline": 0.3},
}
# Profile-score percentiles (p25, p50, p75, p90) per position, latest season, players with 900+ minutes.
_POSITION_CUTOFFS = {
    "Forward":    (36.8, 42.8, 49.3, 56.2),
    "Midfielder": (32.1, 36.7, 41.3, 45.3),
    "Defender":   (47.4, 54.2, 60.0, 65.8),
    "Goalkeeper": (59.5, 82.6, 92.1, 96.3),
}
_MIN_RELIABLE_MINUTES = 450


def _position_profile(position: str, categories: dict) -> dict:
    weights = _POSITION_WEIGHTS.get(position, _POSITION_WEIGHTS["Midfielder"])
    p25, p50, p75, p90 = _POSITION_CUTOFFS.get(position, _POSITION_CUTOFFS["Midfielder"])
    score = sum(categories.get(k, {}).get("score", 0) * w for k, w in weights.items())
    band = ("top_10" if score >= p90 else "top_25" if score >= p75 else "above_median" if score >= p50
            else "below_median" if score >= p25 else "bottom_25")
    return {"score": round(score, 1), "band": band, "categories_used": list(weights), "cutoffs": [p25, p50, p75, p90]}


def _get_verdict(r: dict) -> str:
    profile = r.get("profile", {})
    score = profile.get("score", 0)
    p25, p50, p75, p90 = profile.get("cutoffs", _POSITION_CUTOFFS["Midfielder"])
    talent = r.get("stats", {}).get("talent_score") or 0
    injury = r.get("injury_risk", {}).get("score")
    injury = 0 if injury is None else injury  # unknown risk neither blocks nor triggers a verdict
    value = r.get("value_assessment", {}).get("value_score", 0)
    age = r.get("info", {}).get("age") or 25
    minutes = r.get("minutes_played") or 0

    if minutes < _MIN_RELIABLE_MINUTES:
        return "LIMITED DATA — Under 450 minutes this season. Scores are not yet reliable."
    if score >= p90 and talent >= 75 and injury < 60 and age < 25:
        return "ELITE PROSPECT — High priority target. Top 10% for the position with room to grow."
    if score >= p75 and talent >= 65 and age < 29:
        return "STRONG RECOMMENDATION — Top 25% for the position with a strong talent score. Consider for recruitment."
    if value >= 50 and score >= p50:
        return "VALUE BUY — Above-median for the position at a low price. Undervalued relative to output."
    if age >= 30 and score >= p75:
        return "VETERAN OPTION — Experienced, top 25% for the position. Short-term solution for immediate impact."
    if injury >= 60 or (score < p25 and talent < 45):
        return "CAUTION — Elevated risk factors. Further scouting recommended before decision."
    return "MODERATE PROSPECT — Mixed metrics. Additional observation required."


@app.get("/report/{name}")
async def player_report(name: str):
    try:
        profile = await _proxy(f"{PLAYER_SERVICE}/players/{urllib.parse.quote(name)}")
    except HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(404, f"Player not found: {name}")
        raise HTTPException(status_code=e.response.status_code, detail="Player service error")
    radar = _compute_radar(profile)
    return _compute_report(profile, radar)
