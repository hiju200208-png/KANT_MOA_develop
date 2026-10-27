"""원본 프로젝트 전체 카탈로그 입력. DDL·기존 행 덮어쓰기·내부 commit 없음."""

import asyncio
from datetime import date, datetime
import hashlib
import json
import os
from pathlib import Path
import re

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

ASSET_ROOT = Path(__file__).resolve().parents[3] / "assets"
SNAPSHOT_PATH = Path(__file__).with_name("catalog_snapshot.json")
TABLES = ("artists", "categories", "products", "product_variants", "product_images",
          "artist_members", "artist_banners", "home_banners", "notices", "shop_settings")
IMAGE_FIELDS = {
    "artists": ("logo_path", "hero_image_path"), "products": ("thumbnail_path",),
    "product_images": ("image_path",), "artist_members": ("image_path",),
    "artist_banners": ("image_path",), "home_banners": ("image_path",),
}


def local_database_url(value: str | None) -> str:
    if not value:
        raise ValueError("P2_SEED_DATABASE_URL에 준비된 로컬 DB 주소를 지정해주세요.")
    try:
        url = make_url(value)
    except Exception:
        raise ValueError("로컬 PostgreSQL 주소 형식을 확인해주세요.") from None
    if (url.drivername != "postgresql+asyncpg"
            or url.host not in {"localhost", "127.0.0.1", "::1"}
            or not url.database or url.query):
        raise ValueError("접속 옵션 없는 로컬 PostgreSQL+asyncpg 주소만 허용합니다.")
    return value


def load_catalog() -> dict:
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    if snapshot["format_version"] != 1 or set(snapshot["tables"]) != set(TABLES):
        raise ValueError("카탈로그 스냅샷 형식이 다릅니다.")
    if snapshot["missing_images"]:
        raise ValueError("원본에 누락된 이미지가 있습니다.")
    return snapshot


def validate_images(snapshot: dict) -> None:
    manifest = json.loads((ASSET_ROOT / "catalog-image-manifest.json").read_text(encoding="utf-8"))
    if manifest["archive_sha256"] != snapshot["archive_sha256"]:
        raise ValueError("카탈로그와 원본 이미지 ZIP 버전이 다릅니다.")
    for table, fields in IMAGE_FIELDS.items():
        for row in snapshot["tables"][table]:
            for field in fields:
                path = row[field]
                if not path:
                    continue
                if not path.startswith("/static/"):
                    raise ValueError("카탈로그 이미지 경로를 확인해주세요.")
                relative = path.removeprefix("/static/")
                file = (ASSET_ROOT / relative).resolve()
                if (not file.is_relative_to(ASSET_ROOT.resolve()) or not file.is_file()
                        or relative not in manifest["files"]):
                    raise ValueError("원본 이미지 누락: " + relative)
                if hashlib.sha256(file.read_bytes()).hexdigest() != manifest["files"][relative]["sha256"]:
                    raise ValueError("원본 이미지 내용 불일치: " + relative)


def _values(row: dict) -> dict:
    result = dict(row)
    for key, value in row.items():
        if not re.fullmatch(r"[a-z][a-z0-9_]*", key):
            raise ValueError("카탈로그 컬럼 이름을 확인해주세요.")
        if value is not None:
            if key.endswith("_at"):
                result[key] = datetime.fromisoformat(value)
            elif key in ("birthday", "release_date"):
                result[key] = date.fromisoformat(value)
    return result


async def seed_catalog(session: AsyncSession) -> dict[str, int]:
    """호출자 트랜잭션에서 최초 전체 입력 또는 기존 전체 입력의 재실행 확인만 한다."""
    snapshot = load_catalog()
    validate_images(snapshot)
    tables = snapshot["tables"]
    await session.execute(text("SELECT pg_advisory_xact_lock(2042102704)"))
    existing = {}
    for table in TABLES:
        existing[table] = {row["id"]: dict(row) for row in
                           (await session.execute(text(f'SELECT * FROM public."{table}"'))).mappings()}
    if any(existing.values()):
        # 원본 ID 전체가 있어야 한다. 다른/부분/데모 데이터와 자동 병합하지 않는다.
        complete = all({row["id"] for row in tables[t]} <= existing[t].keys() for t in TABLES)
        if complete:
            for table in ("artists", "categories"):
                complete &= all(existing[table][r["id"]]["slug"] == r["slug"] for r in tables[table])
            complete &= all(existing["products"][r["id"]]["artist_id"] == r["artist_id"]
                            for r in tables["products"])
        if not complete:
            raise ValueError("기존 카탈로그가 원본 전체와 다릅니다. 덮어쓰지 않았습니다.")
        return {table: len(tables[table]) for table in TABLES}
    for table in TABLES:
        rows = tables[table]
        if not rows:
            continue
        columns = list(rows[0])
        query = text(f'INSERT INTO public."{table}" ('
                     + ", ".join('"' + c + '"' for c in columns)
                     + ") OVERRIDING SYSTEM VALUE VALUES ("
                     + ", ".join(":" + c for c in columns) + ")")
        await session.execute(query, [_values(row) for row in rows])
        if type(rows[0]["id"]) is int:
            # 명시 ID 이후 일반 INSERT가 충돌하지 않도록 identity를 앞으로만 진행한다.
            sequence = await session.scalar(text("SELECT pg_get_serial_sequence(:table, 'id')"),
                                            {"table": "public." + table})
            if sequence:
                last = await session.scalar(text(f"SELECT last_value FROM {sequence}"))
                await session.execute(text("SELECT setval(CAST(:sequence AS regclass), :value, true)"),
                                      {"sequence": sequence, "value": max(last, max(r["id"] for r in rows))})
    await session.flush()
    return {table: len(tables[table]) for table in TABLES}


async def main() -> None:
    url = local_database_url(os.environ.get("P2_SEED_DATABASE_URL"))
    engine = create_async_engine(url)
    try:
        async with async_sessionmaker(engine)() as session, session.begin():
            counts = await seed_catalog(session)
        print(json.dumps(counts, ensure_ascii=False))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
