"""P2 fixture가 생성한 일회용 Docker 안에서만 최초 이력 절차를 검증합니다."""

import asyncio
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import asyncpg
import pytest
from sqlalchemy.engine import make_url


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("baseline_adoption", ROOT / "scripts/adopt_shared_baseline.py")
adoption = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adoption)


async def connect(url):
    parsed = make_url(url)
    return await asyncpg.connect(host=parsed.host, port=parsed.port,
                                 user=parsed.username, password=parsed.password, database=parsed.database)


def test_baseline_adoption_preserves_data_and_rolls_back(postgres_url, monkeypatch):
    """조회·대상 거부·중간 실패 rollback·정상 등록·재실행 거부를 확인합니다."""
    original_snapshot = adoption.schema_snapshot

    async def scenario():
        reference_name = "baseline_ref_" + uuid4().hex[:10]
        target_name = "baseline_target_" + uuid4().hex[:10]
        parsed = make_url(postgres_url)
        admin = await connect(postgres_url)
        try:
            for name in (reference_name, target_name):
                await admin.execute(f'CREATE DATABASE "{name}"')
            reference_url = parsed.set(database=reference_name).render_as_string(hide_password=False)
            target_url = parsed.set(database=target_name).render_as_string(hide_password=False)
            env = {**os.environ, "DATABASE_URL": reference_url, "JWT_SECRET": "baseline-test-only-secret-00000000000000000000"}
            result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "3f21520f9615"],
                                    cwd=ROOT, env=env, capture_output=True)
            assert result.returncode == 0, "검증 기준 DB 마이그레이션 실패"
            target = await connect(target_url)
            try:
                await target.execute((ROOT / "sql/001_create_tables.sql").read_text(encoding="utf-8"))
                user_id = uuid4()
                await target.execute("INSERT INTO users(id,email,password_hash,nickname) VALUES($1,'baseline@example.com','test-hash','테스트')", user_id)
                await target.execute("INSERT INTO artists(name,name_ko,slug) VALUES('TEST','테스트','baseline-test')")
                await target.execute("INSERT INTO token_blacklist VALUES('baseline-jti',now()+interval '1 hour')")
                checked = await adoption.run(reference_url, target_url, target_name, parsed.username)
                assert checked["status"] == "CHECK_OK"
                assert await target.fetchval("SELECT to_regclass('public.alembic_version')") is None
                with pytest.raises(ValueError, match="DB·계정"):
                    await adoption.run(reference_url, target_url, "wrong_database", parsed.username, True)
                # 예상하지 못한 구조가 있으면 적용 전 중단합니다.
                await target.execute("ALTER TABLE artists ADD COLUMN unexpected text")
                with pytest.raises(ValueError, match="스키마 차이"):
                    await adoption.run(reference_url, target_url, target_name, parsed.username, True)
                await target.execute("ALTER TABLE artists DROP COLUMN unexpected")
                # 사후 검증 실패 시 이미 추가한 제약·인덱스도 모두 rollback돼야 합니다.
                def fail_after_changes(connection):
                    snapshot = original_snapshot(connection)
                    if connection.engine.url.database == target_name and any(
                        row["name"] == adoption.INDEX for row in snapshot["indexes"]
                    ):
                        snapshot["triggers"].append({"unexpected": True})
                    return snapshot
                monkeypatch.setattr(adoption, "schema_snapshot", fail_after_changes)
                with pytest.raises(ValueError, match="스키마 차이"):
                    await adoption.run(reference_url, target_url, target_name, parsed.username, True)
                monkeypatch.setattr(adoption, "schema_snapshot", original_snapshot)
                assert await target.fetchval("SELECT to_regclass('public.alembic_version')") is None
                assert await target.fetchval("SELECT to_regclass('public.ix_token_blacklist_expires_at')") is None
                applied = await adoption.run(reference_url, target_url, target_name, parsed.username, True)
                assert applied["revision"] == adoption.HEAD
                assert await target.fetchval("SELECT id FROM users WHERE email='baseline@example.com'") == user_id
                assert await target.fetchval("SELECT count(*) FROM artists WHERE slug='baseline-test'") == 1
                assert await target.fetchval("SELECT count(*) FROM token_blacklist WHERE jti='baseline-jti'") == 1
                with pytest.raises(ValueError, match="이력이 이미"):
                    await adoption.run(reference_url, target_url, target_name, parsed.username, True)
                with pytest.raises(asyncpg.CheckViolationError):
                    await target.execute("INSERT INTO users(email,nickname) VALUES('invalid@example.com','거부')")
            finally:
                await target.close()
        finally:
            for name in (target_name, reference_name):
                # 이 테스트가 위에서 생성한 UUID 이름의 격리 DB만 정리합니다.
                await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
            await admin.close()

    asyncio.run(scenario())
