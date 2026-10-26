import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

from dataclasses import dataclass

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin.application.stock_service import AdminStockService
from admin.domain.stock_adjustment import InsufficientStock
from admin.presentation.dependencies import get_admin_stock_service, require_admin
from admin.presentation.router import router
from core.errors import ApiError, register_error_handlers

URL = "/admin/products/12/variants/301/stock-adjustments"


@dataclass
class FakeVariant:
    id: int
    product_id: int
    stock: int


class FakeStockPort:
    def __init__(self, *variants):
        self.variants = {v.id: v for v in variants}

    async def lock_variant(self, variant_id):
        return self.variants.get(variant_id)

    async def increase_stock(self, variant, quantity):
        variant.stock += quantity
        return variant.stock

    async def decrease_stock(self, variant, quantity):
        if variant.stock - quantity < 0:
            raise InsufficientStock()  # 연결부가 P2 예외를 이렇게 바꿔 올린다고 가정
        variant.stock -= quantity
        return variant.stock


class FakeTransaction:
    def __init__(self):
        self.commits = self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def build(role="ADMIN"):
    variant = FakeVariant(id=301, product_id=12, stock=37)
    tx = FakeTransaction()
    service = AdminStockService(FakeStockPort(variant), tx)

    async def fake_require_admin():
        if role is None:
            raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")
        if role != "ADMIN":
            raise ApiError(403, "UNKNOWN", "접근 권한이 없어요.")

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_admin] = fake_require_admin
    app.dependency_overrides[get_admin_stock_service] = lambda: service
    return TestClient(app), variant, tx


def test_admin_increases_stock():
    client, variant, tx = build()
    res = client.post(URL, json={"change": 10, "reason": "입고"})
    assert res.status_code == 200
    assert res.json() == {"variant_id": 301, "before": 37, "after": 47, "change": 10}
    assert variant.stock == 47 and tx.commits == 1


def test_not_logged_in_is_401():
    client, variant, _ = build(role=None)
    res = client.post(URL, json={"change": 10})
    assert res.status_code == 401
    assert res.json()["code"] == "NOT_AUTHENTICATED"
    assert variant.stock == 37


def test_normal_user_is_403():
    client, variant, _ = build(role="USER")
    res = client.post(URL, json={"change": 10})
    assert res.status_code == 403
    assert set(res.json()) == {"code", "message"}
    assert variant.stock == 37


def test_below_zero_is_409_and_rolled_back():
    client, variant, tx = build()
    res = client.post(URL, json={"change": -40})
    assert res.status_code == 409
    assert res.json() == {"code": "UNKNOWN", "message": "재고는 0개보다 적을 수 없어요."}
    assert variant.stock == 37 and (tx.commits, tx.rollbacks) == (0, 1)


def test_variant_of_other_product_is_404():
    client, variant, _ = build()
    res = client.post("/admin/products/99/variants/301/stock-adjustments", json={"change": 1})
    assert res.status_code == 404
    assert res.json()["message"] == "옵션을 찾을 수 없어요."
    assert variant.stock == 37


@pytest.mark.parametrize("body", [{"change": 0}, {"change": 10001}, {"change": "10"}, {}])
def test_invalid_body_is_422_without_echo(body):
    client, variant, _ = build()
    res = client.post(URL, json=body)
    assert res.status_code == 422
    assert set(res.json()) == {"code", "message"}
    assert variant.stock == 37


def test_placeholder_dependencies_block_access_before_integration():
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    res = TestClient(app).post(URL, json={"change": 1})
    assert res.status_code in (401, 503)
