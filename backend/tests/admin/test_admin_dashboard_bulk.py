import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")
os.environ.setdefault("JWT_SECRET", "test-only-not-a-real-secret-000000000000000000000000")

import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin.application.product_service import AdminProductService, AdminProductStatusService
from admin.domain.product_view import AdminDashboardSummary, InvalidBulkRequest, ensure_bulk_product_ids
from admin.domain.stock_adjustment import ProductNotFound
from admin.presentation.dependencies import (
    get_admin_product_service,
    get_admin_product_status_service,
    require_admin,
)
from admin.presentation.router import router
from core.errors import ApiError, register_error_handlers


# --- 도메인 ---
def test_bulk_ids_sorted_and_validated():
    assert ensure_bulk_product_ids([3, 1, 2]) == [1, 2, 3]
    for bad in ([], [1, 1], list(range(1, 102)), [0], [-1]):
        with pytest.raises(InvalidBulkRequest):
            ensure_bulk_product_ids(bad)


# --- 가짜 저장소 ---
class FakeStore:
    def __init__(self, existing=(1, 2, 3)):
        self.saved = {i: "on_sale" for i in existing}
        self.pending = None

    async def dashboard_summary(self):
        return AdminDashboardSummary(total=4, on_sale=2, sold_out=1, hidden=1, out_of_stock=1, low_stock=2)

    async def update_status_many(self, ids, status):
        self.pending = dict(self.saved)
        hit = [i for i in ids if i in self.pending]
        for i in hit:
            self.pending[i] = status
        return hit

    async def get_product(self, product_id):
        return None


class FakeTx:
    def __init__(self, store):
        self.store, self.commits, self.rollbacks = store, 0, 0

    async def commit(self):
        self.store.saved, self.store.pending = self.store.pending, None
        self.commits += 1

    async def rollback(self):
        self.store.pending = None
        self.rollbacks += 1


def make():
    store = FakeStore()
    tx = FakeTx(store)
    return AdminProductStatusService(store, store, tx), store, tx


# --- 서비스 ---
def test_bulk_changes_all_and_commits_once():
    service, store, tx = make()
    assert asyncio.run(service.change_status_bulk([3, 1], "hidden")) == [1, 3]
    assert store.saved == {1: "hidden", 2: "on_sale", 3: "hidden"} and (tx.commits, tx.rollbacks) == (1, 0)


def test_bulk_with_missing_product_changes_nothing():
    service, store, tx = make()
    with pytest.raises(ProductNotFound):
        asyncio.run(service.change_status_bulk([1, 99], "hidden"))
    assert store.saved == {1: "on_sale", 2: "on_sale", 3: "on_sale"} and (tx.commits, tx.rollbacks) == (0, 1)


def test_bulk_invalid_status_rolls_back():
    service, store, tx = make()
    from admin.domain.product_view import InvalidProductStatus

    with pytest.raises(InvalidProductStatus):
        asyncio.run(service.change_status_bulk([1], "deleted"))
    assert tx.rollbacks == 1 and store.pending is None


# --- API ---
def build(role="ADMIN"):
    service, store, tx = make()

    async def fake_require_admin():
        if role is None:
            raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")
        if role != "ADMIN":
            raise ApiError(403, "UNKNOWN", "접근 권한이 없어요.")

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_admin] = fake_require_admin
    app.dependency_overrides[get_admin_product_status_service] = lambda: service
    app.dependency_overrides[get_admin_product_service] = lambda: AdminProductService(store)
    return TestClient(app), store, tx


def test_dashboard_returns_counts():
    client, _, _ = build()
    res = client.get("/admin/dashboard")
    assert res.status_code == 200
    assert res.json() == {"total": 4, "on_sale": 2, "sold_out": 1, "hidden": 1, "out_of_stock": 1, "low_stock": 2}


def test_bulk_api_ok():
    client, store, _ = build()
    res = client.post("/admin/products/bulk-status", json={"product_ids": [2, 1], "status": "sold_out"})
    assert res.status_code == 200
    assert res.json() == {"status": "sold_out", "product_ids": [1, 2], "updated": 2}


def test_bulk_api_missing_is_404_and_nothing_changed():
    client, store, tx = build()
    res = client.post("/admin/products/bulk-status", json={"product_ids": [1, 99], "status": "hidden"})
    assert res.status_code == 404 and res.json()["code"] == "UNKNOWN"
    assert set(store.saved.values()) == {"on_sale"} and tx.commits == 0


@pytest.mark.parametrize(
    "body",
    [{"product_ids": [], "status": "hidden"}, {"product_ids": [1, 1], "status": "hidden"},
     {"product_ids": ["1"], "status": "hidden"}, {"product_ids": [1], "status": "deleted"},
     {"product_ids": list(range(1, 102)), "status": "hidden"}, {"status": "hidden"}],
    ids=["empty", "duplicate", "string-id", "bad-status", "over-100", "missing-ids"],
)
def test_bulk_api_invalid_is_422(body):
    client, store, tx = build()
    res = client.post("/admin/products/bulk-status", json=body)
    assert res.status_code == 422 and set(res.json()) == {"code", "message"}
    assert tx.commits == 0


@pytest.mark.parametrize("role,status", [(None, 401), ("USER", 403)], ids=["anonymous", "user"])
def test_dashboard_and_bulk_need_admin(role, status):
    client, store, _ = build(role=role)
    assert client.get("/admin/dashboard").status_code == status
    assert client.post("/admin/products/bulk-status", json={"product_ids": [1], "status": "hidden"}).status_code == status
    assert set(store.saved.values()) == {"on_sale"}


# --- main.py 등록 ---
def test_main_app_registers_admin_routes_with_real_p1_auth():
    from main import app

    paths = set(app.openapi()["paths"])
    assert {"/admin/products", "/admin/dashboard", "/admin/products/bulk-status", "/admin/notices"} <= paths
    res = TestClient(app).get("/admin/products")  # 토큰 없음 → 실제 P1 require_admin
    assert res.status_code == 401 and res.json()["code"] == "NOT_AUTHENTICATED"
