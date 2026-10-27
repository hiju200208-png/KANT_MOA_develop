# [test] P3 API 통합: 실제 회원가입·로그인 토큰 → HTTP 요청 → 실제 PostgreSQL (옵트인: P3_RUN_POSTGRES_TESTS=1)
# main.py 앱을 그대로 쓰고, 공통 get_session만 쓰고 버리는 테스트 DB 세션으로 바꿔 끼운다.
# P1 인증(get_current_user·블랙리스트)과 P3 주문·P2 재고가 같은 DB에서 한 번에 맞물리는지 확인한다.
import asyncio
from uuid import uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from database import get_session
from main import app

RECIPIENT = {"recipient_name": "김여름", "recipient_phone": "010-1234-5678", "address": "서울 강남구 테헤란로 1"}
PASSWORD = "Api-test-password-1"


async def _seed_variant(factory) -> int:
    """배송비 설정과 판매 중 옵션 하나(가격 20,000원, 재고 5, 1인 4개)를 넣는다. 회원은 API로 가입한다."""
    async with factory() as s:
        await s.execute(text(
            "INSERT INTO shop_settings (free_shipping_threshold, shipping_fee, ship_days_text, company_name, ceo_name, "
            "business_number, ecommerce_number, address, cs_phone, cs_hours) "
            "VALUES (50000, 3000, '2~3일', '칸트', '대표', '0', '0', '서울', '0', '0')"))
        artist = (await s.execute(text(
            "INSERT INTO artists (name, name_ko, slug) VALUES ('A', '에이', 'a') RETURNING id"))).scalar_one()
        category = (await s.execute(text(
            "INSERT INTO categories (name, slug) VALUES ('응원봉', 'lightstick') RETURNING id"))).scalar_one()
        product = (await s.execute(text(
            "INSERT INTO products (artist_id, category_id, name, price, status) "
            "VALUES (:a, :c, '공식 응원봉', 20000, 'on_sale') RETURNING id"), {"a": artist, "c": category})).scalar_one()
        variant = (await s.execute(text(
            "INSERT INTO product_variants (product_id, option_name, extra_price, stock, max_per_user) "
            "VALUES (:p, '기본', 0, 5, 4) RETURNING id"), {"p": product})).scalar_one()
        await s.commit()
    return variant


async def _scalar(factory, sql: str, **params):
    async with factory() as s:
        return (await s.execute(text(sql), params)).scalar_one()


async def _signup_and_login(client: httpx.AsyncClient, nickname: str) -> dict[str, str]:
    email = f"p3-api-{uuid4().hex[:8]}@example.com"
    res = await client.post("/auth/signup", json={"email": email, "nickname": nickname, "password": PASSWORD})
    assert res.status_code == 201, res.text
    res = await client.post("/auth/login", data={"username": email, "password": PASSWORD})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_order_pay_cancel_with_real_tokens_on_real_db(postgres_url):
    async def scenario():
        engine = create_async_engine(postgres_url)
        factory = async_sessionmaker(engine, expire_on_commit=False)

        async def test_session():
            # database.get_session과 같은 계약: 서비스가 commit, 끝날 때 남은 트랜잭션은 rollback
            async with factory() as session:
                try:
                    yield session
                finally:
                    if session.in_transaction():
                        await session.rollback()

        app.dependency_overrides[get_session] = test_session
        stock = lambda: _scalar(factory, "SELECT stock FROM product_variants WHERE id = :v", v=variant)  # noqa: E731
        try:
            variant = await _seed_variant(factory)
            # lifespan(공통 엔진 연결)은 돌리지 않는다: 이 테스트는 위 세션만 쓴다
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                # 토큰 없이 보호 API → 401
                res = await client.get("/orders")
                assert (res.status_code, res.json()["code"]) == (401, "NOT_AUTHENTICATED")

                me = await _signup_and_login(client, "주문자")
                other = await _signup_and_login(client, "다른 회원")

                # 장바구니 담기 → 주문 생성: 재고는 그대로 (차감은 결제 때)
                res = await client.post("/cart/items", json={"variant_id": variant, "quantity": 2}, headers=me)
                assert res.status_code == 200
                res = await client.post("/orders", json=RECIPIENT, headers=me)
                assert res.status_code == 201
                order = res.json()
                assert (order["status"], order["total_price"], order["shipping_fee"]) == ("pending", 43000, 3000)
                order_id = order["id"]
                assert await stock() == 5

                # 다른 회원은 내 주문을 보거나 결제할 수 없다 → 403, DB 그대로
                for res in (await client.get(f"/orders/{order_id}", headers=other),
                            await client.post(f"/orders/{order_id}/pay", headers=other)):
                    assert (res.status_code, res.json()["code"]) == (403, "UNKNOWN")
                assert await stock() == 5
                assert await _scalar(factory, "SELECT status FROM orders WHERE id = :o", o=order_id) == "pending"

                # 결제 → 재고 5 → 3, 결제된 옵션은 장바구니에서 빠짐
                res = await client.post(f"/orders/{order_id}/pay", headers=me)
                assert (res.status_code, res.json()["status"]) == (200, "paid")
                assert await stock() == 3
                assert await _scalar(factory, "SELECT count(*) FROM cart_items") == 0

                # 취소 → 재고 3 → 5 복구
                res = await client.post(f"/orders/{order_id}/cancel", headers=me)
                assert (res.status_code, res.json()["status"]) == (200, "cancelled")
                assert await stock() == 5
                assert await _scalar(factory, "SELECT cancelled_at IS NOT NULL FROM orders WHERE id = :o", o=order_id)

                # 로그아웃 → 같은 토큰으로 다시 부르면 401 (블랙리스트), 다른 회원 토큰은 그대로 동작
                assert (await client.get("/orders", headers=me)).status_code == 200
                res = await client.post("/auth/logout", headers=me)
                assert res.status_code == 204
                assert await _scalar(factory, "SELECT count(*) FROM token_blacklist") == 1
                res = await client.get("/orders", headers=me)
                assert (res.status_code, res.json()["code"]) == (401, "NOT_AUTHENTICATED")
                assert (await client.get("/orders", headers=other)).status_code == 200
        finally:
            app.dependency_overrides.pop(get_session, None)
            await engine.dispose()

    asyncio.run(scenario())
