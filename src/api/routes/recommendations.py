"""
Hybrid Recommendation Engine — content-based + collaborative filtering.
Requires JWT. Calls similarity service for KNN lookups.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient
from collections import Counter
import os, urllib.parse

from src.db.engine import get_db
from src.db.models import User, PlayerView, SavedPlayer
from src.middleware.auth import get_current_user

SIMILARITY_SERVICE = os.getenv("SIMILARITY_SERVICE", "http://127.0.0.1:8002")

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


async def _fetch_similar(client: AsyncClient, player: str, top_n: int = 10):
    try:
        r = await client.get(
            f"{SIMILARITY_SERVICE}/similar/{urllib.parse.quote(player, safe='')}",
            params={"top_n": top_n, "same_position": "true"},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return []


async def _content_based(
    client: AsyncClient,
    recent_players: list[str],
    limit: int = 20,
) -> list[dict]:
    """Aggregate similar players from user's recently viewed/saved players."""
    scores: dict[str, float] = {}
    for i, pname in enumerate(recent_players[:5]):
        similars = await _fetch_similar(client, pname)
        for rank, s in enumerate(similars):
            p = s["Player"]
            # Weight by position in query list + similarity rank
            weight = (5 - i) * (1 - rank / max(len(similars), 1)) * s["similarity_pct"] / 100
            scores[p] = scores.get(p, 0) + weight
    # Remove query players from results
    query_set = set(n.lower() for n in recent_players)
    filtered = [(p, s) for p, s in scores.items() if p.lower() not in query_set]
    filtered.sort(key=lambda x: -x[1])
    return [{"Player": p, "score": round(s, 2), "source": "content"} for p, s in filtered[:limit]]


async def _collaborative_filtering(
    db: AsyncSession,
    user_id: str,
    limit: int = 20,
) -> list[dict]:
    """Users who viewed similar players → recommend their other viewed players."""
    # Get current user's viewed players
    mine_result = await db.execute(
        select(PlayerView.player_name)
        .where(PlayerView.user_id == user_id)
        .distinct()
    )
    my_players = {r[0].lower() for r in mine_result.all()}
    if not my_players:
        return []

    # Get all other users who viewed at least 2 of the same players
    common_result = await db.execute(
        select(PlayerView.user_id, PlayerView.player_name)
        .where(PlayerView.user_id != user_id)
    )
    user_players: dict[str, set[str]] = {}
    for row in common_result.all():
        uid = str(row.user_id)
        pname = row.player_name.lower()
        user_players.setdefault(uid, set()).add(pname)

    # Score users by Jaccard similarity
    user_scores: list[tuple[str, float]] = []
    for uid, pset in user_players.items():
        intersection = my_players & pset
        if len(intersection) >= 2:
            jaccard = len(intersection) / max(len(my_players | pset), 1)
            user_scores.append((uid, jaccard))

    user_scores.sort(key=lambda x: -x[1])

    # Collect recommended players from similar users
    rec_scores: dict[str, float] = {}
    for uid, sim in user_scores[:10]:
        for pname in user_players[uid]:
            if pname not in my_players:
                rec_scores[pname] = rec_scores.get(pname, 0) + sim

    sorted_recs = sorted(rec_scores.items(), key=lambda x: -x[1])
    return [{"Player": p, "score": round(s, 4), "source": "collaborative"} for p, s in sorted_recs[:limit]]


@router.get("/personalized")
async def personalized_recommendations(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hybrid recommendations for the current user."""
    # Get user's recent interactions
    recent_result = await db.execute(
        select(PlayerView.player_name, PlayerView.created_at)
        .where(PlayerView.user_id == current_user.id)
        .order_by(desc(PlayerView.created_at))
        .limit(10)
    )
    recent = list(dict.fromkeys(r[0] for r in recent_result.all()))

    # Also add saved players
    saved_result = await db.execute(
        select(SavedPlayer.player_name)
        .where(SavedPlayer.user_id == current_user.id)
    )
    saved = [r[0] for r in saved_result.all()]

    all_players = recent + saved
    if not all_players:
        # No history → return top hidden gems
        async with AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{os.getenv('PLAYER_SERVICE', 'http://127.0.0.1:8001')}/recommend",
                    params={"top_n": limit, "min_minutes": 500},
                    timeout=10,
                )
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                pass
        return []

    async with AsyncClient() as client:
        content = await _content_based(client, all_players, limit)

    collab = await _collaborative_filtering(db, str(current_user.id), limit)

    # Hybrid merge: content score (0-1 normalized) + collab score
    content_map = {p["Player"].lower(): p for p in content}
    collab_map = {p["Player"].lower(): p for p in collab}

    merged: dict[str, dict] = {}
    key_order: list[str] = []

    for item in content:
        key = item["Player"]
        merged[key] = {
            "Player": key,
            "content_score": item["score"],
            "collab_score": collab_map[key]["score"] if key.lower() in collab_map else 0,
        }
        key_order.append(key)

    for item in collab:
        key = item["Player"]
        if key not in merged:
            merged[key] = {
                "Player": key,
                "content_score": 0,
                "collab_score": item["score"],
            }
            key_order.append(key)

    # Normalize and combine
    max_content = max((v["content_score"] for v in merged.values()), default=1)
    max_collab = max((v["collab_score"] for v in merged.values()), default=1)

    for v in merged.values():
        cn = v["content_score"] / max_content if max_content > 0 else 0
        cl = v["collab_score"] / max_collab if max_collab > 0 else 0
        v["hybrid_score"] = round(0.6 * cn + 0.4 * cl, 4)

    result = sorted(merged.values(), key=lambda x: -x["hybrid_score"])[:limit]
    return result


@router.get("/for-player/{player_name}")
async def recommendations_for_player(
    player_name: str,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
):
    """Content-based: players similar to a specific player (wraps similarity service)."""
    async with AsyncClient() as client:
        results = await _fetch_similar(client, player_name, limit)
    return results


@router.get("/trending")
async def trending_players(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Most-viewed players across all users (trending signal). Public: returns aggregate counts only."""
    result = await db.execute(
        select(PlayerView.player_name, func.count().label("views"))
        .group_by(PlayerView.player_name)
        .order_by(desc("views"))
        .limit(limit)
    )
    return [
        {"Player": row[0], "view_count": row[1]}
        for row in result.all()
    ]
