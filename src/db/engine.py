from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from src.config import get_settings, to_asyncpg_url


url = to_asyncpg_url(get_settings().database_url)
engine = create_async_engine(url, echo=False, pool_pre_ping=True, connect_args={"ssl": "require"})
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
