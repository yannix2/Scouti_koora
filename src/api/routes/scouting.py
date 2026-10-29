"""
Scouting CRUD + tracking routes — all require JWT.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel, Field, field_validator

from src.db.engine import get_db
from src.db.models import User, SavedPlayer, ScoutingList, ScoutingListItem, PlayerView
from src.middleware.auth import get_current_user

router = APIRouter(prefix="/scouting", tags=["scouting"])

# ── Schemas ──────────────────────────────────────────────────────────

PlayerName = Field(min_length=1, max_length=100)


def _check_player_name(v: str) -> str:
    # Names are forwarded as URL path segments to internal services; block path tricks.
    if "/" in v or "\\" in v or ".." in v:
        raise ValueError("Invalid player name")
    return v.strip()


class SavePlayerRequest(BaseModel):
    player_name: str = PlayerName
    notes: Optional[str] = None

    _name = field_validator("player_name")(_check_player_name)

class CreateListRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = False

class UpdateListRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class AddListItemRequest(BaseModel):
    player_name: str = PlayerName
    notes: Optional[str] = None

    _name = field_validator("player_name")(_check_player_name)

class TrackRequest(BaseModel):
    player_name: str = PlayerName
    interaction_type: str = "view"  # view, save, compare, search
    metadata_json: Optional[str] = None

    _name = field_validator("player_name")(_check_player_name)

# ── Saved Players ────────────────────────────────────────────────────

@router.get("/saved")
async def list_saved(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedPlayer)
        .where(SavedPlayer.user_id == current_user.id)
        .order_by(desc(SavedPlayer.created_at))
    )
    return result.scalars().all()


@router.post("/saved", status_code=201)
async def save_player(
    body: SavePlayerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(SavedPlayer).where(
            SavedPlayer.user_id == current_user.id,
            SavedPlayer.player_name == body.player_name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, detail="Player already saved")

    sp = SavedPlayer(
        user_id=current_user.id,
        player_name=body.player_name,
        notes=body.notes,
    )
    db.add(sp)
    await db.commit()
    await db.refresh(sp)
    return sp


@router.delete("/saved/{player_name}", status_code=204)
async def unsave_player(
    player_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(SavedPlayer).where(
            SavedPlayer.user_id == current_user.id,
            SavedPlayer.player_name == player_name,
        )
    )
    await db.commit()

# ── Scouting Lists ───────────────────────────────────────────────────

@router.get("/lists")
async def list_lists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScoutingList)
        .where(ScoutingList.user_id == current_user.id)
        .order_by(desc(ScoutingList.created_at))
    )
    return result.scalars().all()


@router.post("/lists", status_code=201)
async def create_list(
    body: CreateListRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sl = ScoutingList(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        is_public=body.is_public,
    )
    db.add(sl)
    await db.commit()
    await db.refresh(sl)
    return sl


@router.get("/lists/{list_id}")
async def get_list(
    list_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScoutingList).where(ScoutingList.id == list_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(404, detail="List not found")
    if sl.user_id != current_user.id and not sl.is_public:
        raise HTTPException(403, detail="Not authorized")

    items_result = await db.execute(
        select(ScoutingListItem)
        .where(ScoutingListItem.list_id == sl.id)
        .order_by(desc(ScoutingListItem.created_at))
    )
    return {
        **{c.name: getattr(sl, c.name) for c in sl.__table__.columns},
        "items": items_result.scalars().all(),
    }


@router.put("/lists/{list_id}")
async def update_list(
    list_id: str,
    body: UpdateListRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScoutingList).where(ScoutingList.id == list_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(404, detail="List not found")
    if sl.user_id != current_user.id:
        raise HTTPException(403, detail="Not authorized")

    if body.name is not None:
        sl.name = body.name
    if body.description is not None:
        sl.description = body.description
    if body.is_public is not None:
        sl.is_public = body.is_public
    await db.commit()
    await db.refresh(sl)
    return sl


@router.delete("/lists/{list_id}", status_code=204)
async def delete_list(
    list_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScoutingList).where(ScoutingList.id == list_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(404, detail="List not found")
    if sl.user_id != current_user.id:
        raise HTTPException(403, detail="Not authorized")

    await db.execute(delete(ScoutingListItem).where(ScoutingListItem.list_id == sl.id))
    await db.execute(delete(ScoutingList).where(ScoutingList.id == sl.id))
    await db.commit()

# ── List Items ───────────────────────────────────────────────────────

@router.get("/lists/{list_id}/items")
async def get_list_items(
    list_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScoutingList).where(ScoutingList.id == list_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(404, detail="List not found")
    if sl.user_id != current_user.id and not sl.is_public:
        raise HTTPException(403, detail="Not authorized")

    items = await db.execute(
        select(ScoutingListItem)
        .where(ScoutingListItem.list_id == list_id)
        .order_by(desc(ScoutingListItem.created_at))
    )
    return items.scalars().all()


@router.post("/lists/{list_id}/items", status_code=201)
async def add_list_item(
    list_id: str,
    body: AddListItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScoutingList).where(ScoutingList.id == list_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(404, detail="List not found")
    if sl.user_id != current_user.id:
        raise HTTPException(403, detail="Not authorized")

    item = ScoutingListItem(
        list_id=sl.id,
        player_name=body.player_name,
        notes=body.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/lists/{list_id}/items/{item_id}", status_code=204)
async def remove_list_item(
    list_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScoutingList).where(ScoutingList.id == list_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(404, detail="List not found")
    if sl.user_id != current_user.id:
        raise HTTPException(403, detail="Not authorized")

    await db.execute(
        delete(ScoutingListItem).where(
            ScoutingListItem.id == item_id,
            ScoutingListItem.list_id == list_id,
        )
    )
    await db.commit()

# ── Tracking ─────────────────────────────────────────────────────────

@router.post("/track", status_code=201)
async def track_interaction(
    body: TrackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pv = PlayerView(
        user_id=current_user.id,
        player_name=body.player_name,
        interaction_type=body.interaction_type,
        metadata_json=body.metadata_json,
    )
    db.add(pv)
    await db.commit()
    return {"status": "logged"}


@router.get("/history")
async def view_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlayerView)
        .where(PlayerView.user_id == current_user.id)
        .order_by(desc(PlayerView.created_at))
        .limit(limit)
    )
    return result.scalars().all()
