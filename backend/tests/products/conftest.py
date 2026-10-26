"""옵트인 테스트 전용 Docker DB. 기존 DATABASE_URL·Compose DB에 접속하지 않는다."""

import os
from pathlib import Path
import secrets
import subprocess
import time
from uuid import uuid4

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")


@pytest.fixture(scope="session")
def postgres_url():
    if os.environ.get("P2_RUN_POSTGRES_TESTS") != "1":
        pytest.skip("P2_RUN_POSTGRES_TESTS=1로 전용 Docker PostgreSQL 테스트 실행")
    container = f"kant-p2-test-{uuid4().hex[:12]}"
    password = secrets.token_hex(16)

    def docker(*args, **kwargs):
        return subprocess.run(["docker", *args], check=True, capture_output=True, **kwargs)

    try:
        docker("run", "--detach", "--name", container, "--label", "kant.p2.test=true",
               "--publish", "127.0.0.1::5432", "--env", "POSTGRES_DB=p2_test",
               "--env", "POSTGRES_USER=p2_test", "--env", f"POSTGRES_PASSWORD={password}",
               "postgres:18-alpine")
        for _ in range(120):
            ready = subprocess.run(
                ["docker", "exec", container, "pg_isready", "-U", "p2_test", "-d", "p2_test"],
                capture_output=True,
            )
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            pytest.fail("전용 PostgreSQL 기동 시간 초과")
        # 초기 SQL은 이 fixture가 방금 만든 빈 테스트 DB에만 한 번 적용한다.
        sql = Path(__file__).resolve().parents[2] / "sql" / "001_create_tables.sql"
        docker("exec", "-i", container, "psql", "-X", "-U", "p2_test", "-d", "p2_test",
               "-v", "ON_ERROR_STOP=1", input=sql.read_bytes())
        port = docker("port", container, "5432/tcp").stdout.decode().strip().rsplit(":", 1)[1]
        yield f"postgresql+asyncpg://p2_test:{password}@127.0.0.1:{port}/p2_test"
    finally:
        subprocess.run(["docker", "rm", "--force", "--volumes", container], capture_output=True)
