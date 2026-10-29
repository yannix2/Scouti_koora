import uuid
from pydantic import BaseModel, EmailStr
from typing import Optional
from src.db.models import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.scout


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: UserRole
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}
