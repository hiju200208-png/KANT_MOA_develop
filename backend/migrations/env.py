import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config


# backend/src를 Python 모듈 검색 경로에 추가합니다.
sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "src"),
)

from core.config import get_settings
from database import Base

# 모델 import 시 테이블이 공통 Base.metadata에 등록됩니다.
from auth.infrastructure import models as auth_models
from products.infrastructure import models as product_models


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 실제 접속 정보는 backend/.env에서 읽습니다.
# Alembic 설정의 % 보간을 피하기 위해 이스케이프합니다.
config.set_main_option(
    "sqlalchemy.url",
    get_settings().database_url.replace("%", "%%"),
)

target_metadata = Base.metadata


def include_object(
    obj,
    name,
    type_,
    reflected,
    compare_to,
):
    # DB에는 있지만 ORM에 등록되지 않은 테이블의
    # 자동 삭제안은 생성하지 않습니다.
    if type_ == "table" and reflected and compare_to is None:
        return False

    return True


def run_migrations_offline() -> None:
    """DB에 접속하지 않고 마이그레이션 SQL을 생성합니다."""
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """연결된 DB에서 마이그레이션을 실행합니다."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """기존 비동기 PostgreSQL 접속 설정을 사용합니다."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    try:
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)
    finally:
        await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()