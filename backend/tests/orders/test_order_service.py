# [test] 주문 서비스: 생성·바로 구매·결제·취소의 흐름, 잠금 순서, 실패 시 전체 rollback (가짜 저장소, DB 없음)
import asyncio
import functools
from uuid import uuid4

import pytest
from order_fakes import NOW, FakeOrderRepository, FakeStock, FakeUnitOfWork, variant

from orders.application.order_service import OrderService
from orders.domain.checkout import Recipient
from orders.domain.exceptions import (
    CartEmpty,
    InvalidOrderTransition,
    OrderAccessDenied,
    OrderAlreadyCancelled,
    OrderNotFound,
    OutOfStock,
    PurchaseLimitExceeded,
    VariantUnavailable,
)
from orders.domain.order_status import OrderStatus

ME, OTHER = uuid4(), uuid4()
RECIPIENT = Recipient("김여름", "010-1234-5678", "서울 강남구 1")


def sync(test):
    """async 테스트를 asyncio.run으로 돌린다 (장바구니 테스트와 같은 방식, 별도 플러그인 없음)."""

    @functools.wraps(test)
    def run(*args, **kwargs):
        return asyncio.run(test(*args, **kwargs))

    return run


@pytest.fixture
def env(cart_repo):
    cart_repo.variants = {1: variant(1, unit_price=20000), 2: variant(2, unit_price=10000, stock=1),
                          3: variant(3, product_status="sold_out")}
    orders = FakeOrderRepository()
    stock = FakeStock({1: 5, 2: 1, 3: 5})
    tx = FakeUnitOfWork(orders, cart_repo, stock)
    service = OrderService(orders, cart_repo, stock, tx, now=lambda: NOW)
    return service, orders, cart_repo, stock, tx


def put_cart(cart_repo, user, items):
    for variant_id, quantity in items.items():
        cart_repo.saved[(user, variant_id)] = quantity


# ---------- 주문 생성 ----------

@sync
async def test_create_from_cart_keeps_stock_and_cart(env):
    service, orders, cart, stock, tx = env
    put_cart(cart, ME, {1: 2, 2: 1})
    order = await service.create_from_cart(ME, RECIPIENT)
    assert order.status is OrderStatus.PENDING
    assert (order.items_price, order.shipping_fee, order.total_price) == (50000, 0, 50000)
    assert stock.saved == {1: 5, 2: 1, 3: 5}  # 규칙: 주문 생성 때는 재고를 빼지 않는다
    assert cart.saved == {(ME, 1): 2, (ME, 2): 1}  # 장바구니도 그대로
    assert (tx.commits, orders.locked_users) == (1, [ME])


@sync
async def test_empty_cart_rolls_back(env):
    service, orders, *_, tx = env
    with pytest.raises(CartEmpty):
        await service.create_from_cart(ME, RECIPIENT)
    assert (orders.saved, tx.rollbacks) == ({}, 1)


@sync
async def test_cart_with_sold_out_item_cannot_order(env):
    service, orders, cart, *_ = env
    put_cart(cart, ME, {1: 1, 3: 1})
    with pytest.raises(VariantUnavailable):
        await service.create_from_cart(ME, RECIPIENT)
    assert orders.saved == {}


@sync
async def test_create_checks_purchase_limit_with_paid_quantity(env):
    service, _, cart, *_ = env
    cart.paid[(ME, 1)] = 3
    put_cart(cart, ME, {1: 2})
    with pytest.raises(PurchaseLimitExceeded):
        await service.create_from_cart(ME, RECIPIENT)


# ---------- 바로 구매 ----------

@sync
async def test_direct_order_adds_shipping_fee_under_threshold(env):
    service, *_ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 1)
    assert (order.is_direct, order.items_price, order.shipping_fee, order.total_price) == (True, 20000, 3000, 23000)


# ---------- 결제 ----------

@sync
async def test_pay_decreases_stock_and_removes_only_paid_items_from_cart(env):
    service, orders, cart, stock, tx = env
    put_cart(cart, ME, {2: 1, 1: 2})
    order = await service.create_from_cart(ME, RECIPIENT)
    put_cart(cart, ME, {3: 1})  # 주문 뒤에 담은 다른 상품은 장바구니에 남아야 한다
    paid = await service.pay(ME, order.id)
    assert (paid.status, paid.paid_at) == (OrderStatus.PAID, NOW)
    assert stock.saved == {1: 3, 2: 0, 3: 5}
    assert cart.saved == {(ME, 3): 1}
    assert stock.lock_calls == [[1, 2]]  # 규칙: 옵션은 id 오름차순으로 한 번에 잠근다
    assert orders.saved[order.id].status is OrderStatus.PAID


@sync
async def test_direct_order_payment_keeps_cart(env):
    service, _, cart, stock, _ = env
    put_cart(cart, ME, {1: 1})
    order = await service.create_direct(ME, RECIPIENT, 1, 2)
    await service.pay(ME, order.id)
    assert (stock.saved[1], cart.saved) == (3, {(ME, 1): 1})


@sync
async def test_pay_twice_is_invalid_and_stock_decreases_once(env):
    service, _, _, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 1)
    await service.pay(ME, order.id)
    with pytest.raises(InvalidOrderTransition) as caught:
        await service.pay(ME, order.id)
    assert caught.value.code == "INVALID_ORDER"
    assert stock.saved[1] == 4


@sync
async def test_pay_failure_on_second_item_rolls_back_everything(env):
    service, orders, cart, stock, tx = env
    put_cart(cart, ME, {1: 2, 2: 1})
    order = await service.create_from_cart(ME, RECIPIENT)
    stock.saved[2] = 0  # 다른 사람이 먼저 결제해서 옵션 2가 품절됨
    with pytest.raises(OutOfStock):
        await service.pay(ME, order.id)
    assert stock.saved == {1: 5, 2: 0, 3: 5}  # 옵션 1 차감도 되돌려짐
    assert orders.saved[order.id].status is OrderStatus.PENDING
    assert cart.saved == {(ME, 1): 2, (ME, 2): 1}
    assert tx.rollbacks == 1


@sync
async def test_pay_rechecks_purchase_limit(env):
    service, orders, cart, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 2)
    cart.paid[(ME, 1)] = 3  # 주문 뒤 다른 주문으로 3개를 이미 결제함
    with pytest.raises(PurchaseLimitExceeded):
        await service.pay(ME, order.id)
    assert stock.saved[1] == 5


@sync
async def test_pay_rejects_product_that_stopped_selling(env):
    service, _, cart, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 1)
    cart.variants[1] = variant(1, product_status="hidden")
    with pytest.raises(VariantUnavailable):
        await service.pay(ME, order.id)
    assert stock.saved[1] == 5


@sync
async def test_lock_order_is_user_then_order_then_variants(env):
    service, orders, _, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 1)
    orders.locked_users.clear()
    await service.pay(ME, order.id)
    assert (orders.locked_users, orders.locked_orders, stock.lock_calls) == ([ME], [order.id], [[1]])


# ---------- 취소 ----------

@sync
async def test_cancel_pending_does_not_touch_stock(env):
    service, _, _, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 1)
    cancelled = await service.cancel(ME, order.id)
    assert (cancelled.status, cancelled.cancelled_at) == (OrderStatus.CANCELLED, NOW)
    assert (stock.saved[1], stock.lock_calls) == (5, [])


@sync
async def test_cancel_paid_restores_stock_once(env):
    service, _, _, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 2)
    await service.pay(ME, order.id)
    await service.cancel(ME, order.id)
    assert stock.saved[1] == 5
    with pytest.raises(OrderAlreadyCancelled):
        await service.cancel(ME, order.id)
    assert stock.saved[1] == 5  # 두 번째 취소는 재고를 또 늘리지 않는다


@sync
async def test_cancel_restores_even_if_product_is_hidden_now(env):
    service, _, cart, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 1)
    await service.pay(ME, order.id)
    cart.variants[1] = variant(1, product_status="hidden")
    await service.cancel(ME, order.id)
    assert stock.saved[1] == 5


# ---------- 소유권·조회 ----------

@pytest.mark.parametrize("method", ["pay", "cancel", "get"])
@sync
async def test_other_users_order_is_denied(env, method):
    service, orders, _, stock, _ = env
    order = await service.create_direct(ME, RECIPIENT, 1, 1)
    with pytest.raises(OrderAccessDenied):
        await getattr(service, method)(OTHER, order.id)
    assert orders.saved[order.id].status is OrderStatus.PENDING
    assert stock.saved[1] == 5


@pytest.mark.parametrize("method", ["pay", "cancel", "get"])
@sync
async def test_missing_order_is_not_found(env, method):
    service, *_ = env
    with pytest.raises(OrderNotFound):
        await getattr(service, method)(ME, uuid4())


@sync
async def test_list_filters_my_orders_by_status(env):
    service, *_ = env
    first = await service.create_direct(ME, RECIPIENT, 1, 1)
    second = await service.create_direct(ME, RECIPIENT, 1, 1)
    await service.create_direct(OTHER, RECIPIENT, 1, 1)
    await service.pay(ME, first.id)
    items, total = await service.list(ME, None, None, 1, 20)
    assert ([o.id for o in items], total) == ([second.id, first.id], 2)  # 최신순
    items, total = await service.list(ME, "paid", None, 1, 20)
    assert ([o.id for o in items], total) == ([first.id], 1)
