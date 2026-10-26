import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

import asyncio
from dataclasses import replace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin.application.product_service import AdminProductStatusService
from admin.domain.product_view import (
    AdminProductDetailRow,
    AdminProductRow,
    AdminVariantRow,
    InvalidProductStatus,
    ensure_product_status,
)
from admin.domain.stock_adjustment import ProductNotFound
from admin.presentation.dependencies import get_admin_product_status_service, require_admin
from admin.presentation.router import router
from core.errors import ApiError, register_error_handlers

URL = "/admin/products/1"


class FakeStore:
    """조회·변경 포트를 함께 흉내 낸다. commit 전 변경은 rollback 시 되돌린다."""

    def __init__(self, status="on_sale", total=0):
        self.saved = AdminProductRow(
            id=1, name="포토카드", artist_slug="bts", artist_name="BTS", category_slug="card",
            category_name="카드", price=12000, status=status, thumbnail_path=None,
            total_stock=total, variant_count=1,
        )
        self.pending = None

    async def update_status(self, product_id, status):
        if product_id != 1:
            return False
        self.pending = replace(self.saved, status=status)
        return True

    async def get_product(self, product_id):
        if product_id != 1:
            return None
        current = self.pending or self.saved
        return AdminProductDetailRow(current, (AdminVariantRow(11, "기본", 0, current.total_stock, 4),))


class FakeTransaction:
    def __init__(self, store, fail_commit=False):
        self.store, self.fail_commit = store, fail_commit
        self.commits = self.rollbacks = 0

    async def commit(self):
        if self.fail_commit:
            raise RuntimeError("db down")
        self.store.saved, self.store.pending = self.store.pending, None
        self.commits += 1

    async def rollback(self):
        self.store.pending = None
        self.rollbacks += 1


def make_service(store=None, **kw):
    store = store or FakeStore()
    tx = FakeTransaction(store, **kw)
    return AdminProductStatusService(store, store, tx), store, tx


# --- 도메인 ---
@pytest.mark.parametrize("status", ["on_sale", "sold_out", "hidden"])
def test_allowed_statuses(status):
    assert ensure_product_status(status) == status


@pytest.mark.parametrize("status", ["deleted", "", "HIDDEN"])
def test_unknown_status_is_rejected(status):
    with pytest.raises(InvalidProductStatus):
        ensure_product_status(status)


# --- 서비스 ---
def test_change_commits_and_returns_new_detail():
    service, store, tx = make_service()
    detail = asyncio.run(service.change_status(1, "hidden"))
    assert detail.product.status == "hidden"
    assert store.saved.status == "hidden" and (tx.commits, tx.rollbacks) == (1, 0)


def test_on_sale_with_zero_stock_stays_on_sale_but_sold_out():
    service, store, _ = make_service(FakeStore(status="hidden", total=0))
    detail = asyncio.run(service.change_status(1, "on_sale"))
    assert detail.product.status == "on_sale" and detail.product.is_sold_out


def test_missing_product_rolls_back():
    service, store, tx = make_service()
    with pytest.raises(ProductNotFound):
        asyncio.run(service.change_status(9, "hidden"))
    assert (tx.commits, tx.rollbacks) == (0, 1) and store.saved.status == "on_sale"


def test_invalid_status_rolls_back_without_writing():
    service, store, tx = make_service()
    with pytest.raises(InvalidProductStatus):
        asyncio.run(service.change_status(1, "deleted"))
    assert store.pending is None and tx.rollbacks == 1


def test_commit_failure_rolls_back():
    service, store, tx = make_service(fail_commit=True)
    with pytest.raises(RuntimeError):
        asyncio.run(service.change_status(1, "hidden"))
    assert tx.rollbacks == 1 and store.saved.status == "on_sale"


# --- API ---
def build(role="ADMIN"):
    service, store, tx = make_service()

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
    return TestClient(app), store, tx


def test_patch_hides_product():
    client, store, tx = build()
    res = client.patch(URL, json={"status": "hidden"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "hidden" and body["id"] == 1 and len(body["variants"]) == 1
    assert tx.commits == 1


def test_patch_missing_product_is_404():
    client, _, tx = build()
    res = client.patch("/admin/products/9", json={"status": "hidden"})
    assert res.status_code == 404
    assert res.json() == {"code": "UNKNOWN", "message": "상품을 찾을 수 없어요."}
    assert tx.rollbacks == 1


@pytest.mark.parametrize(
    "url,body",
    [
        (URL, {"status": "deleted"}),
        (URL, {}),
        (URL, {"status": "hidden", "price": 0}),
        (URL, {"status": None}),
        ("/admin/products/0", {"status": "hidden"}),
    ],
)
def test_patch_invalid_input_is_422(url, body):
    client, store, tx = build()
    res = client.patch(url, json=body)
    assert res.status_code == 422
    assert set(res.json()) == {"code", "message"}
    assert store.saved.status == "on_sale" and tx.commits == 0


@pytest.mark.parametrize("role,status", [(None, 401), ("USER", 403)])
def test_patch_non_admin_is_blocked(role, status):
    client, store, tx = build(role=role)
    assert client.patch(URL, json={"status": "hidden"}).status_code == status
    assert store.saved.status == "on_sale" and tx.commits == 0
