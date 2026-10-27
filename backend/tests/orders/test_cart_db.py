# [test] 장바구니 실제 PostgreSQL 통합 테스트 (옵트인: P3_RUN_POSTGRES_TESTS=1)
# 쓰고 버리는 전용 컨테이너에서만 실행한다. 재고(stock)는 읽기만 하고 바뀌지 않는지도 확인한다.
import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from orders.application.cart_service import CartService
from orders.domain.exceptions import PurchaseLimitExceeded
from orders.infrastructure.cart_repository import CartRepository
from orders.infrastructure.transaction import SessionTransaction


async def _setup(url: str):
    """회원 2명, 상품 3개(판매 중·품절·숨김)와 옵션을 넣는다. 옵션 id를 돌려준다."""
    engine = create_async_engine(url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    me, other = uuid4(), uuid4()
    async with factory() as s:
        for user_id, email in ((me, "me@test.local"), (other, "other@test.local")):
            await s.execute(text("INSERT INTO users (id, email, nickname, password_hash) VALUES (:i, :e, '테스트', 'x')"),
                            {"i": user_id, "e": email})
        artist = (await s.execute(text("INSERT INTO artists (name, name_ko, slug) VALUES ('A', '에이', 'a') RETURNING id"))).scalar_one()
        category = (await s.execute(text("INSERT INTO categories (name, slug) VALUES ('응원봉', 'lightstick') RETURNING id"))).scalar_one()
        ids = {}
        for key, status, stock, limit in (("on_sale", "on_sale", 5, 4), ("sold_out", "sold_out", 5, 4),
                                          ("hidden", "hidden", 5, 4), ("unlimited", "on_sale", 3, None)):
            product = (await s.execute(
                text("INSERT INTO products (artist_id, category_id, name, price, status, thumbnail_path) "
                     "VALUES (:a, :c, :n, 30000, :s, '/static/products/a.webp') RETURNING id"),
                {"a": artist, "c": category, "n": f"상품-{key}", "s": status})).scalar_one()
            ids[key] = (await s.execute(
                text("INSERT INTO product_variants (product_id, option_name, extra_price, stock, max_per_user) "
                     "VALUES (:p, '기본', 5000, :st, :m) RETURNING id"),
                {"p": product, "st": stock, "m": limit})).scalar_one()
        await s.commit()
    return engine, factory, me, other, ids


async def _call(factory, method: str, *args):
    async with factory() as session:
        return await getattr(CartService(CartRepository(session), SessionTransaction(session)), method)(*args)


async def _stock(factory, variant_id: int) -> int:
    async with factory() as s:
        return (await s.execute(text("SELECT stock FROM product_variants WHERE id = :i"), {"i": variant_id})).scalar_one()


def test_cart_flow_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, other, ids = await _setup(postgres_url)
        try:
            await _call(factory, "add", me, ids["on_sale"], 1)
            cart = await _call(factory, "add", me, ids["on_sale"], 2)  # 같은 옵션 → 수량 더함
            line = cart.lines[0]
            assert (line.quantity, line.variant.unit_price) == (3, 35000)  # 기본가 30000 + 추가금 5000
            assert cart.total_price == 105000

            await _call(factory, "change_quantity", me, ids["on_sale"], 1)
            await _call(factory, "add", me, ids["unlimited"], 2)
            cart = await _call(factory, "remove", me, ids["unlimited"])
            assert [(l.variant.variant_id, l.quantity) for l in cart.lines] == [(ids["on_sale"], 1)]
            assert (await _call(factory, "get_cart", other)).lines == []  # 남의 장바구니와 분리

            # 담은 뒤 상품이 숨김 처리되면 목록에서 빠진다 (DB 행은 남음)
            async with factory() as s:
                await s.execute(text("UPDATE products SET status = 'hidden' WHERE id = "
                                     "(SELECT product_id FROM product_variants WHERE id = :i)"), {"i": ids["on_sale"]})
                await s.commit()
            assert (await _call(factory, "get_cart", me)).lines == []

            assert await _stock(factory, ids["on_sale"]) == 5  # 장바구니는 재고를 바꾸지 않는다
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_purchase_limit_counts_paid_orders_only(postgres_url):
    async def scenario():
        engine, factory, me, other, ids = await _setup(postgres_url)
        try:
            variant_id = ids["on_sale"]
            async with factory() as s:
                for user_id, status, qty in ((me, "paid", 3), (me, "pending", 3), (me, "cancelled", 3), (other, "paid", 4)):
                    order = (await s.execute(
                        text("INSERT INTO orders (user_id, status, total_price, recipient_name, recipient_phone, address, "
                             "paid_at, cancelled_at) VALUES (:u, :st, 0, 'a', '010', 'addr', "
                             "CASE WHEN :st = 'paid' THEN now() END, CASE WHEN :st = 'cancelled' THEN now() END) RETURNING id"),
                        {"u": user_id, "st": status})).scalar_one()
                    await s.execute(text("INSERT INTO order_items (order_id, variant_id, product_name, option_name, "
                                         "unit_price, quantity) VALUES (:o, :v, 'p', '기본', 0, :q)"),
                                    {"o": order, "v": variant_id, "q": qty})
                await s.commit()
            await _call(factory, "add", me, variant_id, 1)  # 내 paid 3 + 1 = 4 → 가능
            with pytest.raises(PurchaseLimitExceeded):
                await _call(factory, "change_quantity", me, variant_id, 2)  # 3 + 2 = 5 > 4
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_merge_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, _, ids = await _setup(postgres_url)
        try:
            await _call(factory, "add", me, ids["on_sale"], 2)
            cart = await _call(factory, "merge_guest", me, [
                (ids["on_sale"], 5), (ids["sold_out"], 1), (ids["hidden"], 1), (ids["unlimited"], 9), (999999, 1)])
            quantities = {l.variant.variant_id: l.quantity for l in cart.lines}
            # on_sale: 2+5 → 제한 4, unlimited: 9 → 재고 3, 나머지 건너뜀
            assert quantities == {ids["on_sale"]: 4, ids["unlimited"]: 3}
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_concurrent_add_same_item_keeps_every_quantity(postgres_url):
    """같은 옵션을 동시에 1개씩 4번 담아도 덮어쓰기 없이 4개가 되어야 한다."""

    async def scenario():
        engine, factory, me, _, ids = await _setup(postgres_url)
        try:
            results = await asyncio.gather(*(_call(factory, "add", me, ids["on_sale"], 1) for _ in range(4)),
                                           return_exceptions=True)
            assert [r for r in results if isinstance(r, BaseException)] == []
            cart = await _call(factory, "get_cart", me)
            assert cart.lines[0].quantity == 4
        finally:
            await engine.dispose()

    asyncio.run(scenario())
