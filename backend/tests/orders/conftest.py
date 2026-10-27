# [test] P3 테스트 공용 준비물: DB 없는 가짜 배송지 저장소·트랜잭션, 옵트인 전용 PostgreSQL
import os
import secrets
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import pytest

# database 모듈을 import하는 테스트도 실제 DB에 접속하지 않도록 쓰지 않는 주소를 넣어 둔다.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")
# P1 인증 설정은 JWT_SECRET이 필수라 backend/.env가 없는 PC에서도 수집되게 테스트 전용 값을 넣어 둔다 (실제 비밀값 아님).
os.environ.setdefault("JWT_SECRET", "p3-test-only-not-a-real-secret-0000000000000000")

from orders.domain.address import Address  # noqa: E402

BASE_TIME = datetime(2026, 10, 27, 9, 0, tzinfo=timezone.utc)


class FakeAddressRepository:
    """메모리 저장소. commit 전 변경은 pending에 쌓고, rollback하면 버린다 (실제 트랜잭션 흉내)."""

    def __init__(self):
        self.saved: dict[int, Address] = {}
        self.pending: dict[int, Address] | None = None
        self.next_id = 1
        self.locked_users: list = []

    @property
    def data(self) -> dict[int, Address]:
        if self.pending is None:
            self.pending = {k: Address(v.id, v.user_id, v.content, v.is_default, v.created_at)
                            for k, v in self.saved.items()}
        return self.pending

    def seed(self, user_id, content, is_default=False) -> Address:
        address = Address(self.next_id, user_id, content, is_default, BASE_TIME + timedelta(minutes=self.next_id))
        self.saved[address.id] = address
        self.next_id += 1
        return address

    async def lock_owner(self, user_id):
        self.locked_users.append(user_id)

    async def list_by_user(self, user_id, keyword, page, size):
        rows = [a for a in self.data.values() if a.user_id == user_id
                and (not keyword or keyword in (a.content.label or "") + a.content.recipient_name + a.content.address1)]
        rows.sort(key=lambda a: (a.is_default, a.created_at, a.id), reverse=True)
        return rows[(page - 1) * size: page * size], len(rows)

    async def get(self, address_id):
        return self.data.get(address_id)

    async def count_by_user(self, user_id):
        return sum(1 for a in self.data.values() if a.user_id == user_id)

    async def list_all_by_user(self, user_id):
        return [a for a in self.data.values() if a.user_id == user_id]

    async def add(self, user_id, content, is_default):
        address = Address(self.next_id, user_id, content, is_default, BASE_TIME + timedelta(minutes=self.next_id))
        self.next_id += 1
        self.data[address.id] = address
        self._check_one_default(user_id)
        return address

    async def update_content(self, address_id, content):
        self.data[address_id].content = content

    async def clear_default(self, user_id):
        for a in self.data.values():
            if a.user_id == user_id:
                a.is_default = False

    async def mark_default(self, address_id):
        address = self.data[address_id]
        address.is_default = True
        self._check_one_default(address.user_id)

    async def delete(self, address_id):
        del self.data[address_id]

    def _check_one_default(self, user_id):
        # 실제 DB의 부분 UNIQUE 인덱스처럼 기본 배송지가 2개가 되면 바로 실패시킨다.
        if sum(1 for a in self.data.values() if a.user_id == user_id and a.is_default) > 1:
            raise RuntimeError("addresses_one_default_per_user 위반")


class FakeTransaction:
    def __init__(self, repo: FakeAddressRepository):
        self.repo, self.commits, self.rollbacks = repo, 0, 0

    async def commit(self):
        if self.repo.pending is not None:
            self.repo.saved, self.repo.pending = self.repo.pending, None
        self.commits += 1

    async def rollback(self):
        self.repo.pending = None
        self.rollbacks += 1


class FakeCartRepository:
    """메모리 장바구니. variants는 상품 정보(P2), paid는 이미 결제한 수량. commit 전 변경은 pending."""

    def __init__(self):
        self.variants: dict = {}
        self.paid: dict = {}
        self.saved: dict[tuple, int] = {}  # (user_id, variant_id) → 수량 (담은 순서 유지)
        self.pending: dict[tuple, int] | None = None
        self.locked_users: list = []

    @property
    def data(self) -> dict[tuple, int]:
        if self.pending is None:
            self.pending = dict(self.saved)
        return self.pending

    async def lock_owner(self, user_id):
        self.locked_users.append(user_id)

    async def list_lines(self, user_id):
        from orders.domain.cart import CartLine

        return [CartLine(self.variants[v], q) for (u, v), q in self.data.items() if u == user_id and v in self.variants]

    async def get_variant(self, variant_id):
        return self.variants.get(variant_id)

    async def get_variants(self, variant_ids):
        return {v: self.variants[v] for v in variant_ids if v in self.variants}

    async def get_quantity(self, user_id, variant_id):
        return self.data.get((user_id, variant_id))

    async def paid_quantity(self, user_id, variant_id):
        return self.paid.get((user_id, variant_id), 0)

    async def set_quantity(self, user_id, variant_id, quantity):
        self.data[(user_id, variant_id)] = quantity

    async def delete_item(self, user_id, variant_id):
        return self.data.pop((user_id, variant_id), None) is not None


@pytest.fixture
def cart_repo():
    return FakeCartRepository()


@pytest.fixture
def cart_tx(cart_repo):
    return FakeTransaction(cart_repo)


@pytest.fixture
def address_repo():
    return FakeAddressRepository()


@pytest.fixture
def address_tx(address_repo):
    return FakeTransaction(address_repo)


@pytest.fixture
def postgres_url():
    """P3_RUN_POSTGRES_TESTS=1일 때만 쓰고 버리는 PostgreSQL 컨테이너를 만든다.

    개인 로컬 DB(kant-moa-p2-db-1)와 공용 DB에는 접속하지 않는다. 끝나면 컨테이너를 지운다.
    """
    if os.environ.get("P3_RUN_POSTGRES_TESTS") != "1":
        pytest.skip("P3_RUN_POSTGRES_TESTS=1로 전용 Docker PostgreSQL 테스트 실행")
    container = f"kant-p3-test-{uuid4().hex[:12]}"
    password = secrets.token_hex(16)

    def docker(*args, **kwargs):
        return subprocess.run(["docker", *args], check=True, capture_output=True, **kwargs)

    try:
        docker("run", "--detach", "--name", container, "--label", "kant.p3.test=true",
               "--publish", "127.0.0.1::5432", "--env", "POSTGRES_DB=p3_test",
               "--env", "POSTGRES_USER=p3_test", "--env", f"POSTGRES_PASSWORD={password}", "postgres:17")
        for _ in range(120):
            ready = subprocess.run(["docker", "exec", container, "pg_isready", "-h", "127.0.0.1",
                                    "-U", "p3_test", "-d", "p3_test"], capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            pytest.fail("전용 PostgreSQL 기동 시간 초과")
        # 초기 SQL은 방금 만든 빈 테스트 DB에만 한 번 적용한다.
        sql = Path(__file__).resolve().parents[2] / "sql" / "001_create_tables.sql"
        docker("exec", "-i", container, "psql", "-X", "-U", "p3_test", "-d", "p3_test",
               "-v", "ON_ERROR_STOP=1", input=sql.read_bytes())
        port = docker("port", container, "5432/tcp").stdout.decode().strip().rsplit(":", 1)[1]
        yield f"postgresql+asyncpg://p3_test:{password}@127.0.0.1:{port}/p3_test"
    finally:
        subprocess.run(["docker", "rm", "--force", "--volumes", container], capture_output=True)
