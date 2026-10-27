# [test] 주문 API: 상태 코드(201·200·401·403·404·409·422)·오류 code·응답 모양 (가짜 저장소, DB 없음)
from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from order_fakes import NOW, FakeOrderRepository, FakeStock, FakeUnitOfWork, variant

from core.errors import register_error_handlers
from orders.application.order_service import OrderService
from orders.presentation.dependencies import get_current_user, get_order_service
from orders.presentation.order_router import router

ME, OTHER = uuid4(), uuid4()
RECIPIENT = {"recipient_name": "김여름", "recipient_phone": "010-1234-5678", "address": "서울 강남구 1"}


@dataclass
class FakeUser:
    id: UUID


@pytest.fixture
def stock():
    return FakeStock({1: 5, 2: 1})


@pytest.fixture
def app(cart_repo, stock):
    cart_repo.variants = {1: variant(1, unit_price=20000), 2: variant(2, unit_price=10000, stock=1)}
    orders = FakeOrderRepository()
    tx = FakeUnitOfWork(orders, cart_repo, stock)
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[get_order_service] = lambda: OrderService(orders, cart_repo, stock, tx, now=lambda: NOW)
    return app


def login(app, user_id):
    app.dependency_overrides[get_current_user] = lambda: FakeUser(user_id)


@pytest.fixture
def client(app):
    login(app, ME)
    return TestClient(app)


def direct(client, variant_id=1, quantity=1, **recipient):
    body = {**RECIPIENT, **recipient, "variant_id": variant_id, "quantity": quantity}
    return client.post("/orders/direct", json=body)


# ---------- 정상 ----------

def test_create_from_cart_shape(client, cart_repo):
    cart_repo.saved[(ME, 1)] = 2
    res = client.post("/orders", json=RECIPIENT)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending" and body["is_direct"] is False
    assert (body["items_price"], body["shipping_fee"], body["total_price"]) == (40000, 3000, 43000)
    assert body["items"] == [{"variant_id": 1, "product_name": "상품1", "option_name": "기본",
                              "unit_price": 20000, "quantity": 2, "line_price": 40000}]
    assert body["paid_at"] is None and body["cancelled_at"] is None


def test_pay_cancel_get_and_list(client, stock):
    order_id = direct(client, quantity=2).json()["id"]
    res = client.post(f"/orders/{order_id}/pay")
    assert res.status_code == 200 and res.json()["status"] == "paid" and stock.saved[1] == 3
    res = client.post(f"/orders/{order_id}/cancel")
    assert res.status_code == 200 and res.json()["status"] == "cancelled" and stock.saved[1] == 5
    assert client.get(f"/orders/{order_id}").json()["status"] == "cancelled"
    page = client.get("/orders", params={"status": "cancelled", "page": 1, "size": 10}).json()
    assert (page["total"], page["page"], page["size"], page["items"][0]["id"]) == (1, 1, 10, order_id)


# ---------- 401 ----------

def test_requires_login(app):
    app.dependency_overrides.pop(get_current_user, None)
    res = TestClient(app).get("/orders")
    assert res.status_code == 401 and res.json()["code"] == "NOT_AUTHENTICATED"


# ---------- 403 / 404 ----------

@pytest.mark.parametrize("call", [
    lambda c, i: c.get(f"/orders/{i}"),
    lambda c, i: c.post(f"/orders/{i}/pay"),
    lambda c, i: c.post(f"/orders/{i}/cancel"),
])
def test_other_users_order_is_forbidden(app, client, call):
    order_id = direct(client).json()["id"]
    login(app, OTHER)
    res = call(client, order_id)
    assert res.status_code == 403 and res.json()["code"] == "UNKNOWN"


def test_missing_order_is_404(client):
    res = client.post(f"/orders/{uuid4()}/pay")
    assert res.status_code == 404 and res.json()["code"] == "UNKNOWN"


# ---------- 409 ----------

def test_empty_cart_is_409(client):
    res = client.post("/orders", json=RECIPIENT)
    assert res.status_code == 409 and res.json()["code"] == "CART_EMPTY"


def test_pay_twice_is_409_invalid_order(client):
    order_id = direct(client).json()["id"]
    client.post(f"/orders/{order_id}/pay")
    res = client.post(f"/orders/{order_id}/pay")
    assert res.status_code == 409 and res.json()["code"] == "INVALID_ORDER"


def test_cancel_twice_is_409_already_cancelled(client):
    order_id = direct(client).json()["id"]
    client.post(f"/orders/{order_id}/cancel")
    res = client.post(f"/orders/{order_id}/cancel")
    assert res.status_code == 409 and res.json()["code"] == "ALREADY_CANCELLED"


def test_sold_out_at_payment_is_409_out_of_stock(client, stock):
    order_id = direct(client, variant_id=2).json()["id"]
    stock.saved[2] = 0
    res = client.post(f"/orders/{order_id}/pay")
    assert res.status_code == 409 and res.json()["code"] == "OUT_OF_STOCK"


def test_over_purchase_limit_is_409(client):
    res = direct(client, quantity=5)  # 재고 5라 통과하지만 max_per_user 4를 넘는다
    assert res.status_code == 409 and res.json()["code"] == "PURCHASE_LIMIT_EXCEEDED"


def test_over_stock_is_409_unavailable(client):
    res = direct(client, variant_id=2, quantity=2)  # 재고 1
    assert res.status_code == 409 and res.json()["code"] == "UNAVAILABLE_ITEM"


# ---------- 422 ----------

@pytest.mark.parametrize("body", [
    {**RECIPIENT, "recipient_phone": "02-123-4567"},  # 도메인 검사 (휴대폰 형식)
    {**RECIPIENT, "recipient_name": "   "},  # 도메인 검사 (공백뿐)
    {**RECIPIENT, "address": "  "},  # 도메인 검사 (주소 없음)
    {**RECIPIENT, "total_price": 1},  # 가격은 받지 않는다 (extra 금지)
    {"recipient_name": "김여름"},  # 필수 칸 누락
])
def test_invalid_order_request_is_422_unknown(client, cart_repo, body):
    # 받는 분 입력 오류는 422/UNKNOWN (INVALID_ORDER는 '결제할 수 없는 주문' 안내라 쓰지 않는다)
    cart_repo.saved[(ME, 1)] = 1
    res = client.post("/orders", json=body)
    assert res.status_code == 422 and res.json()["code"] == "UNKNOWN"


def test_invalid_recipient_on_direct_order_is_422_unknown(client):
    res = direct(client, recipient_phone="02-123-4567")
    assert res.status_code == 422 and res.json()["code"] == "UNKNOWN"


@pytest.mark.parametrize("quantity", [0, -1, 100])
def test_invalid_direct_quantity_is_422_invalid_order(client, quantity):
    # 바로 구매 수량 오류만 INVALID_ORDER (예전 create_direct_order와 같은 code)
    res = direct(client, quantity=quantity)
    assert res.status_code == 422 and res.json()["code"] == "INVALID_ORDER"


def test_non_integer_direct_quantity_is_422_unknown(client):
    # 정수가 아닌 값은 형식 오류라 공통 처리기의 422/UNKNOWN
    res = direct(client, quantity="두 개")
    assert res.status_code == 422 and res.json()["code"] == "UNKNOWN"


def test_invalid_order_id_and_status_filter_are_422(client):
    assert client.get("/orders/not-a-uuid").status_code == 422
    assert client.get("/orders", params={"status": "shipped"}).status_code == 422
