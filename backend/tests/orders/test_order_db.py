# [test] 주문 실제 PostgreSQL 통합 테스트 (옵트인: P3_RUN_POSTGRES_TESTS=1)
# 쓰고 버리는 전용 컨테이너에서만 실행한다. 재고는 P2 Repository를 거쳐서만 바뀌는지, rollback·동시성을 확인한다.
import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from orders.application.order_service import OrderService
from orders.domain.checkout import Recipient
from orders.domain.exceptions import (
    InvalidOrderTransition,
    OrderAccessDenied,
    OutOfStock,
    PurchaseLimitExceeded,
)
from orders.domain.order_status import OrderStatus
from orders.infrastructure.cart_repository import CartRepository
from orders.infrastructure.order_repository import OrderRepository
from orders.infrastructure.stock_adapter import ProductStockAdapter
from orders.infrastructure.transaction import SessionTransaction

RECIPIENT = Recipient("김여름", "010-1234-5678", "서울 강남구 1")


async def _setup(url: str):
    """회원 2명, 배송비 설정, 옵션 3개(재고 5·재고 1·제한 3)를 넣는다."""
    engine = create_async_engine(url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    me, other = uuid4(), uuid4()
    async with factory() as s:
        for user_id, email in ((me, "me@test.local"), (other, "other@test.local")):
            await s.execute(text("INSERT INTO users (id, email, nickname, password_hash) VALUES (:i, :e, '테스트', 'x')"),
                            {"i": user_id, "e": email})
        await s.execute(text(
            "INSERT INTO shop_settings (free_shipping_threshold, shipping_fee, ship_days_text, company_name, ceo_name, "
            "business_number, ecommerce_number, address, cs_phone, cs_hours) "
            "VALUES (50000, 3000, '2~3일', '칸트', '대표', '0', '0', '서울', '0', '0')"))
        artist = (await s.execute(text("INSERT INTO artists (name, name_ko, slug) VALUES ('A', '에이', 'a') RETURNING id"))).scalar_one()
        category = (await s.execute(text("INSERT INTO categories (name, slug) VALUES ('응원봉', 'lightstick') RETURNING id"))).scalar_one()
        ids = {}
        for key, price, stock, limit in (("big", 20000, 5, 4), ("last", 10000, 1, 4), ("limited", 10000, 10, 3)):
            product = (await s.execute(
                text("INSERT INTO products (artist_id, category_id, name, price, status) "
                     "VALUES (:a, :c, :n, :p, 'on_sale') RETURNING id"),
                {"a": artist, "c": category, "n": f"상품-{key}", "p": price})).scalar_one()
            ids[key] = (await s.execute(
                text("INSERT INTO product_variants (product_id, option_name, extra_price, stock, max_per_user) "
                     "VALUES (:p, '기본', 0, :st, :m) RETURNING id"),
                {"p": product, "st": stock, "m": limit})).scalar_one()
        await s.commit()
    return engine, factory, me, other, ids


async def _call(factory, method: str, *args):
    """요청 하나 = 세션 하나. 주문·장바구니·재고가 같은 세션을 쓴다 (dependencies.get_order_service와 같은 조립)."""
    async with factory() as session:
        service = OrderService(OrderRepository(session), CartRepository(session), ProductStockAdapter(session),
                               SessionTransaction(session))
        return await getattr(service, method)(*args)


async def _scalar(factory, sql: str, **params):
    async with factory() as s:
        return (await s.execute(text(sql), params)).scalar_one()


async def _stock(factory, variant_id: int) -> int:
    return await _scalar(factory, "SELECT stock FROM product_variants WHERE id = :i", i=variant_id)


async def _add_cart(factory, user_id, variant_id, quantity):
    async with factory() as s:
        await s.execute(text("INSERT INTO cart_items (user_id, variant_id, quantity) VALUES (:u, :v, :q)"),
                        {"u": user_id, "v": variant_id, "q": quantity})
        await s.commit()


def test_cart_order_pay_cancel_flow_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, other, ids = await _setup(postgres_url)
        try:
            await _add_cart(factory, me, ids["big"], 2)
            await _add_cart(factory, me, ids["last"], 1)
            order = await _call(factory, "create_from_cart", me, RECIPIENT)
            # 50000원 이상이라 무료배송, 주문 생성만으로는 재고·장바구니가 그대로다.
            assert (order.items_price, order.shipping_fee, order.total_price) == (50000, 0, 50000)
            assert (await _stock(factory, ids["big"]), await _stock(factory, ids["last"])) == (5, 1)
            assert await _scalar(factory, "SELECT count(*) FROM cart_items WHERE user_id = :u", u=me) == 2

            await _add_cart(factory, me, ids["limited"], 1)  # 주문 뒤에 담은 상품은 결제 후에도 남아야 한다
            paid = await _call(factory, "pay", me, order.id)
            assert paid.status is OrderStatus.PAID and paid.paid_at is not None
            assert (await _stock(factory, ids["big"]), await _stock(factory, ids["last"])) == (3, 0)
            assert await _scalar(factory, "SELECT array_agg(variant_id) FROM cart_items WHERE user_id = :u", u=me) \
                == [ids["limited"]]

            # 남의 주문은 결제·취소·조회 모두 막힌다
            with pytest.raises(OrderAccessDenied):
                await _call(factory, "cancel", other, order.id)

            cancelled = await _call(factory, "cancel", me, order.id)
            assert cancelled.status is OrderStatus.CANCELLED
            assert (await _stock(factory, ids["big"]), await _stock(factory, ids["last"])) == (5, 1)

            # 목록: 상태 필터·상품명 검색(%·_는 글자 그대로)·페이지 크기
            items, total = await _call(factory, "list", me, "cancelled", "big", 1, 20)
            assert (total, [o.id for o in items]) == (1, [order.id])
            assert (await _call(factory, "list", me, None, "%", 1, 20))[1] == 0
            assert (await _call(factory, "list", other, None, None, 1, 20))[1] == 0
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_direct_order_shipping_fee_and_purchase_limit_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, _, ids = await _setup(postgres_url)
        try:
            first = await _call(factory, "create_direct", me, RECIPIENT, ids["limited"], 2)
            assert (first.is_direct, first.shipping_fee, first.total_price) == (True, 3000, 23000)
            await _call(factory, "pay", me, first.id)
            # 이미 2개 결제 → 2개 더는 제한(3) 초과. 결제 대기 주문은 집계에 안 들어가므로 1개는 가능.
            with pytest.raises(PurchaseLimitExceeded):
                await _call(factory, "create_direct", me, RECIPIENT, ids["limited"], 2)
            second = await _call(factory, "create_direct", me, RECIPIENT, ids["limited"], 1)
            third = await _call(factory, "create_direct", me, RECIPIENT, ids["limited"], 1)
            await _call(factory, "pay", me, second.id)
            # 결제 직전 최종 검사: 주문할 때는 통과했어도 그 사이 다른 결제로 제한에 닿았다
            with pytest.raises(PurchaseLimitExceeded):
                await _call(factory, "pay", me, third.id)
            assert await _stock(factory, ids["limited"]) == 7
            # 취소한 결제는 집계에서 빠지므로 다시 결제할 수 있다
            await _call(factory, "cancel", me, first.id)
            await _call(factory, "pay", me, third.id)
            assert await _stock(factory, ids["limited"]) == 8  # 10 - 2 - 1 + 2 - 1
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_pay_failure_rolls_back_all_items_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, _, ids = await _setup(postgres_url)
        try:
            await _add_cart(factory, me, ids["big"], 2)
            await _add_cart(factory, me, ids["last"], 1)
            order = await _call(factory, "create_from_cart", me, RECIPIENT)
            async with factory() as s:  # 다른 손님이 마지막 재고를 먼저 사 간 상황
                await s.execute(text("UPDATE product_variants SET stock = 0 WHERE id = :i"), {"i": ids["last"]})
                await s.commit()
            with pytest.raises(OutOfStock):
                await _call(factory, "pay", me, order.id)
            # 낮은 id 옵션(big)은 먼저 flush됐지만 rollback으로 되돌아와야 한다
            assert await _stock(factory, ids["big"]) == 5
            assert await _scalar(factory, "SELECT status FROM orders WHERE id = :i", i=order.id) == "pending"
            assert await _scalar(factory, "SELECT count(*) FROM cart_items WHERE user_id = :u", u=me) == 2
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_concurrent_payments_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, other, ids = await _setup(postgres_url)
        try:
            # 마지막 1개를 두 사람이 동시에 결제 → 한 명만 성공, 재고는 0 (음수 없음)
            mine = await _call(factory, "create_direct", me, RECIPIENT, ids["last"], 1)
            theirs = await _call(factory, "create_direct", other, RECIPIENT, ids["last"], 1)
            results = await asyncio.gather(_call(factory, "pay", me, mine.id), _call(factory, "pay", other, theirs.id),
                                           return_exceptions=True)
            assert sorted(type(r).__name__ for r in results) == ["Order", "OutOfStock"]
            assert await _stock(factory, ids["last"]) == 0

            # 같은 주문을 동시에 두 번 결제 → 한 번만 paid, 재고도 한 번만 차감
            order = await _call(factory, "create_direct", me, RECIPIENT, ids["big"], 2)
            results = await asyncio.gather(_call(factory, "pay", me, order.id), _call(factory, "pay", me, order.id),
                                           return_exceptions=True)
            assert sorted(type(r).__name__ for r in results) == ["InvalidOrderTransition", "Order"]
            assert await _stock(factory, ids["big"]) == 3

            # 같은 paid 주문을 동시에 두 번 취소 → 재고는 한 번만 복구
            results = await asyncio.gather(_call(factory, "cancel", me, order.id), _call(factory, "cancel", me, order.id),
                                           return_exceptions=True)
            assert sorted(type(r).__name__ for r in results) == ["Order", "OrderAlreadyCancelled"]
            assert await _stock(factory, ids["big"]) == 5
            with pytest.raises(InvalidOrderTransition):
                await _call(factory, "pay", me, order.id)
        finally:
            await engine.dispose()

    asyncio.run(scenario())
