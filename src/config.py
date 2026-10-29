from pydantic_settings import BaseSettings
from functools import lru_cache
from urllib.parse import urlparse, urlunparse


class Settings(BaseSettings):
    # Pooled (-pooler) URL for the app; direct URL for migrations. Both pulled by `neon env pull`.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/scoutiq"
    database_url_unpooled: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 7

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


def to_asyncpg_url(raw: str) -> str:
    """Neon gives postgresql://...?sslmode=require; asyncpg needs the +asyncpg scheme and no libpq params
    (SSL is passed via connect_args instead)."""
    parsed = urlparse(raw)
    scheme = "postgresql+asyncpg" if parsed.scheme in ("postgres", "postgresql") else parsed.scheme
    return urlunparse(parsed._replace(scheme=scheme, query=""))


@lru_cache
def get_settings() -> Settings:
    return Settings()
