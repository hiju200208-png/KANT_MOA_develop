# [test] 장바구니 API: 상태 코드(200·401·404·409·422)·오류 code·응답 모양 (가짜 저장소, DB 없음)
from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.errors import register_error_handlers
from orders.application.cart_service import CartService
from orders.domain.cart import MAX_MERGE_ITEMS, CartVariant
from orders.presentation.cart_router import router
from orders.presentation.dependencies import get_cart_service, get_current_user

ME = uuid4()


@dataclass
class FakeUser:
    id: UUID


def variant(variant_id, **overrides) -> CartVariant:
    values = {"variant_id": variant_id, "product_id": 10, "product_name": "응원봉", "thumbnail_path": "/static/products/a.webp",
              "option_name": "기본", "unit_price": 35000, "stock": 5, "max_per_user": 4, "product_status": "on_sale"}
    values.update(overrides)
    return CartVariant(**values)


@pytest.fixture
def app(cart_repo, cart_tx):
    cart_repo.variants = {1: variant(1), 2: variant(2, stock=1), 3: variant(3, product_status="sold_out"),
                          4: variant(4, product_status="hidden")}
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_cart_service] = lambda: CartService(cart_repo, cart_tx)
    return app


@pytest.fixture
def client(app):
    app.dependency_overrides[get_current_user] = lambda: FakeUser(ME)
    return TestClient(app)


# ---------- 정상 ----------

def test_add_then_get_cart_shape(client):
    res = client.post("/cart/items", json={"variant_id": 1, "quantity": 2})
    assert res.status_code == 200
    body = client.get("/cart").json()
    assert body["total_quantity"] == 2 and body["total_price"] == 70000
    item = body["items"][0]
    assert item == {"variant_id": 1, "quantity": 2,
                    "product": {"id": 10, "name": "응원봉", "thumbnail_url": "/static/products/a.webp"},
                    "option_name": "기본", "unit_price": 35000, "stock": 5, "max_per_user": 4, "is_available": True}


def test_change_and_remove(client):
    client.post("/cart/items", json={"variant_id": 1, "quantity": 1})
    res = client.patch("/cart/items/1", json={"quantity": 3})
    assert res.status_code == 200 and res.json()["items"][0]["quantity"] == 3
    res = client.delete("/cart/items/1")
    assert res.status_code == 200 and res.json() == {"items": [], "total_quantity": 0, "total_price": 0}


def test_merge(client):
    res = client.post("/cart/merge", json={"items": [{"variant_id": 1, "quantity": 9}, {"variant_id": 3, "quantity": 1},
                                                      {"variant_id": 2, "quantity": 0}]})
    assert res.status_code == 200
    assert [(i["variant_id"], i["quantity"]) for i in res.json()["items"]] == [(1, 4)]


# ---------- 401 ----------

def test_without_login_is_401(app):
    res = TestClient(app).get("/cart")
    assert res.status_code == 401 and res.json()["code"] == "NOT_AUTHENTICATED"


# ---------- 404 ----------

@pytest.mark.parametrize("variant_id", [4, 999], ids=["hidden", "missing"])
def test_add_hidden_or_missing_variant_is_404(client, variant_id):
    res = client.post("/cart/items", json={"variant_id": variant_id, "quantity": 1})
    assert res.status_code == 404 and res.json()["code"] == "UNAVAILABLE_ITEM"


def test_change_item_not_in_cart_is_404(client):
    res = client.patch("/cart/items/1", json={"quantity": 1})
    assert res.status_code == 404 and res.json()["code"] == "UNKNOWN"


# ---------- 409 ----------

@pytest.mark.parametrize("variant_id, quantity, code", [
    (3, 1, "UNAVAILABLE_ITEM"),
    (2, 2, "OUT_OF_STOCK"),
    (1, 6, "OUT_OF_STOCK"),  # 재고 5 < 6: 구매 제한(4)보다 재고 검사가 먼저
], ids=["sold-out", "stock-1", "over-stock"])
def test_business_rule_violation_is_409(client, variant_id, quantity, code):
    res = client.post("/cart/items", json={"variant_id": variant_id, "quantity": quantity})
    assert res.status_code == 409 and res.json()["code"] == code


def test_purchase_limit_is_409(client, cart_repo):
    cart_repo.paid[(ME, 1)] = 3
    res = client.post("/cart/items", json={"variant_id": 1, "quantity": 2})
    assert res.status_code == 409 and res.json()["code"] == "PURCHASE_LIMIT_EXCEEDED"


# ---------- 422 ----------

@pytest.mark.parametrize("body", [
    {"variant_id": 1, "quantity": 0},
    {"variant_id": 1, "quantity": 100},
    {"variant_id": 0, "quantity": 1},
    {"variant_id": 1},
    {"variant_id": 1, "quantity": 1, "user_id": str(uuid4())},
], ids=["zero", "over-99", "bad-variant", "missing-quantity", "extra-user-id"])
def test_bad_add_body_is_422(client, body):
    res = client.post("/cart/items", json=body)
    assert res.status_code == 422 and set(res.json()) == {"code", "message"}


def test_too_many_merge_items_is_422(client):
    items = [{"variant_id": i + 1, "quantity": 1} for i in range(MAX_MERGE_ITEMS + 1)]
    assert client.post("/cart/merge", json={"items": items}).status_code == 422


# ---------- 비회원 미리보기 (로그인 불필요) ----------

def test_preview_works_without_login(app):
    res = TestClient(app).post("/cart/preview", json={"items": [{"variant_id": 1, "quantity": 2},
                                                                {"variant_id": 4, "quantity": 1}]})
    assert res.status_code == 200
    body = res.json()
    assert [i["variant_id"] for i in body["items"]] == [1] and body["total_price"] == 70000


def test_preview_rejects_too_many_lines(app):
    items = [{"variant_id": 1, "quantity": 1}] * (MAX_MERGE_ITEMS + 1)
    res = TestClient(app).post("/cart/preview", json={"items": items})
    assert res.status_code == 422 and res.json()["code"] == "UNKNOWN"
