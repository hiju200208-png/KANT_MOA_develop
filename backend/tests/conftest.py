import os
from pathlib import Path

import pytest
from dotenv import dotenv_values, load_dotenv
from sqlalchemy.engine import make_url


def pytest_configure(config):
    # 명시적으로 선택한 경우에만 로컬 DB 설정을 사용합니다.
    if os.environ.get("P1_RUN_LOCAL_DB_TESTS") != "1":
        return

    env_path = Path(__file__).resolve().parents[1] / ".env"
    values = dotenv_values(env_path)
    database_url = values.get("DATABASE_URL")

    if not database_url:
        raise pytest.UsageError("backend/.env의 DATABASE_URL이 필요합니다.")

    url = make_url(database_url)

    if url.host not in {"localhost", "127.0.0.1", "::1"}:
        raise pytest.UsageError(
            "로컬 DB 테스트에서는 localhost 주소만 허용합니다."
        )

    # 테스트 파일 수집 전에 설정해서 가짜 URL의 setdefault를 방지합니다.
    load_dotenv(env_path, override=True)