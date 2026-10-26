import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin.application.product_service import AdminProductService
from admin.domain.product_view import AdminProductDetailRow, AdminProductRow, AdminVariantRow
from admin.domain.stock_adjustment import ProductNotFound
from admin.presentation.dependencies import get_admin_product_service, require_admin
from admin.presentation.router import router
from core.errors import ApiError, register_error_handlers


def row(id, status="on_sale", total=10, thumb="bts/stick.png"):
    return AdminProductRow(
        id=id, name=f"상품{id}", artist_slug="bts", artist_name="BTS",
        category_slug="lightstick", category_name="응원봉", price=45000, status=status,
        thumbnail_path=thumb, total_stock=total, variant_count=2,
    )


class FakeQueries:
    def __init__(self):
        self.last_filters = None
        self.rows = [row(1), row(2, total=0), row(3, status="hidden", thumb=None)]

    async def list_products(self, filters):
        self.last_filters = filters
        return self.rows, 23

    async def get_product(self, product_id):
        if product_id != 1:
            return None
        return AdminProductDetailRow(
            product=row(1, total=3),
            variants=(AdminVariantRow(11, "기본", 0, 1, 4), AdminVariantRow(12, "L", 1000, 2, None)),
        )


def build(role="ADMIN"):
    queries = FakeQueries()

    async def fake_require_admin():
        if role is None:
            raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")
        if role != "ADMIN":
            raise ApiError(403, "UNKNOWN", "접근 권한이 없어요.")

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_admin] = fake_require_admin
    app.dependency_overrides[get_admin_product_service] = lambda: AdminProductService(queries)
    return TestClient(app), queries


def test_list_includes_hidden_and_computes_sold_out():
    client, queries = build()
    res = client.get("/admin/products", params={"q": "응원봉", "status": "hidden", "page": 2, "size": 10})
    assert res.status_code == 200
    body = res.json()
    assert (body["total"], body["page"], body["size"]) == (23, 2, 10)
    assert [i["is_sold_out"] for i in body["items"]] == [False, True, False]
    assert body["items"][2]["status"] == "hidden"
    assert body["items"][0]["thumbnail_url"] == "/static/products/bts/stick.png"
    assert body["items"][0]["artist"] == {"slug": "bts", "name": "BTS"}
    assert queries.last_filters.q == "응원봉" and queries.last_filters.status == "hidden"


def test_detail_returns_variants():
    client, _ = build()
    res = client.get("/admin/products/1")
    assert res.status_code == 200
    body = res.json()
    assert body["is_sold_out"] is False
    assert [v["id"] for v in body["variants"]] == [11, 12]
    assert body["variants"][1]["max_per_user"] is None


def test_missing_product_is_404():
    client, _ = build()
    res = client.get("/admin/products/999")
    assert res.status_code == 404
    assert res.json() == {"code": "UNKNOWN", "message": "상품을 찾을 수 없어요."}


@pytest.mark.parametrize(
    "url",
    [
        "/admin/products?page=0",
        "/admin/products?size=101",
        "/admin/products?status=deleted",
        "/admin/products?stock=many",
        "/admin/products?sort=price",
        "/admin/products?unknown=1",
        "/admin/products/0",
        "/admin/products/abc",
    ],
)
def test_invalid_input_is_422(url):
    client, _ = build()
    res = client.get(url)
    assert res.status_code == 422
    assert set(res.json()) == {"code", "message"}


@pytest.mark.parametrize("role,status", [(None, 401), ("USER", 403)])
def test_non_admin_is_blocked(role, status):
    client, queries = build(role=role)
    assert client.get("/admin/products").status_code == status
    assert client.get("/admin/products/1").status_code == status
    assert queries.last_filters is None


def test_service_raises_not_found():
    with pytest.raises(ProductNotFound):
        asyncio.run(AdminProductService(FakeQueries()).get_product(5))
