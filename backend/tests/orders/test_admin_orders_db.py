# [test] 관리자 주문·배송 API를 실제 토큰과 일회용 PostgreSQL로 확인한다.
import asyncio
from uuid import UUID, uuid4

import httpx
import pytest
from orders.application.admin_order_service import AdminOrderService
from orders.infrastructure.order_repository import OrderRepository
from orders.infrastructure.transaction import SessionTransaction
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from database import get_session
from main import app
from test_order_api_db import RECIPIENT, _scalar, _seed_variant, _signup_and_login


def test_admin_shipping_permissions_transitions_and_cancel_race(postgres_url):
    async def scenario():
        engine = create_async_engine(postgres_url)
        factory = async_sessionmaker(engine, expire_on_commit=False)

        async def sessions():
            async with factory() as session:
                try:
                    yield session
                finally:
                    if session.in_transaction():
                        await session.rollback()

        app.dependency_overrides[get_session] = sessions
        try:
            variant = await _seed_variant(factory)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                user = await _signup_and_login(c, "주문자")
                admin = await _signup_and_login(c, "관리자")
                admin_id = (await c.get("/auth/me", headers=admin)).json()["id"]
                async with factory() as s:
                    await s.execute(text("UPDATE users SET role='ADMIN' WHERE id=:id"), {"id": admin_id})
                    await s.commit()
                assert (await c.get("/orders/admin")).status_code == 401
                assert (await c.get("/orders/admin", headers=user)).status_code == 403
                body = {**RECIPIENT, "variant_id": variant, "quantity": 1}
                order = (await c.post("/orders/direct", json=body, headers=user)).json()
                oid = order["id"]
                endpoint = f"/orders/admin/{oid}/shipping"
                assert (await c.patch(endpoint, json={"status": "shipped"}, headers=user)).status_code == 403
                assert (await c.patch(endpoint, json={"status": "shipped"}, headers=admin)).status_code == 409
                assert await _scalar(factory, "SELECT stock FROM product_variants WHERE id=:v", v=variant) == 5
                assert (await c.post(f"/orders/{oid}/pay", headers=user)).status_code == 200
                rows = (await c.get("/orders/admin?status=paid&shipping_status=preparing&q=공식", headers=admin)).json()
                assert rows["total"] == 1 and rows["items"][0]["id"] == oid
                assert rows["items"][0]["shipping_status"] == "preparing"
                assert (await c.get("/orders/admin?q=%25", headers=admin)).json()["total"] == 0
                assert (await c.patch(endpoint, json={"status": "delivered"}, headers=admin)).status_code == 409
                assert (await c.patch(endpoint, json={"status": "bogus"}, headers=admin)).status_code == 422
                assert (await c.patch(f"/orders/admin/{uuid4()}/shipping", json={"status": "shipped"}, headers=admin)).status_code == 404
                # 저장 후 commit 직전 실패하면 배송 기록을 남기지 않는다.
                class BrokenCommit(SessionTransaction):
                    async def commit(self):
                        raise RuntimeError("forced commit failure")
                async with factory() as session:
                    service = AdminOrderService(OrderRepository(session), BrokenCommit(session))
                    with pytest.raises(RuntimeError, match="forced commit failure"):
                        await service.advance(UUID(oid), UUID(admin_id), "shipped")
                assert await _scalar(factory, "SELECT count(*) FROM order_shipments") == 0
                shipped = await c.patch(endpoint, json={"status": "shipped"}, headers=admin)
                assert shipped.status_code == 200 and shipped.json()["shipped_at"]
                assert (await c.patch(endpoint, json={"status": "shipped"}, headers=admin)).status_code == 409
                # 발송 이후 취소를 막아 실제 출고된 재고가 다시 늘어나지 않게 한다.
                assert (await c.post(f"/orders/{oid}/cancel", headers=user)).status_code == 409
                assert await _scalar(factory, "SELECT stock FROM product_variants WHERE id=:v", v=variant) == 4
                delivered = await c.patch(endpoint, json={"status": "delivered"}, headers=admin)
                assert delivered.status_code == 200 and delivered.json()["delivered_at"]
                assert (await c.patch(endpoint, json={"status": "shipped"}, headers=admin)).status_code == 409
                # 취소와 발송을 동시에 요청해도 둘 중 하나만 성공해야 한다.
                raced = (await c.post("/orders/direct", json=body, headers=user)).json()["id"]
                assert (await c.post(f"/orders/{raced}/pay", headers=user)).status_code == 200
                results = await asyncio.gather(
                    c.patch(f"/orders/admin/{raced}/shipping", json={"status": "shipped"}, headers=admin),
                    c.post(f"/orders/{raced}/cancel", headers=user),
                )
                assert sorted(r.status_code for r in results) == [200, 409]
                state = await _scalar(factory, "SELECT status FROM orders WHERE id=:o", o=raced)
                stock = await _scalar(factory, "SELECT stock FROM product_variants WHERE id=:v", v=variant)
                assert (state, stock) in {("paid", 3), ("cancelled", 4)}
                first = (await c.get("/orders/admin?size=1&page=1", headers=admin)).json()
                second = (await c.get("/orders/admin?size=1&page=2", headers=admin)).json()
                assert first["total"] == second["total"] == 2
                assert first["items"][0]["id"] != second["items"][0]["id"]
                assert (await c.get("/orders/admin?size=101", headers=admin)).status_code == 422
                assert (await c.get("/orders/admin?shipping_status=delivered", headers=admin)).json()["total"] == 1
        finally:
            app.dependency_overrides.pop(get_session, None)
            await engine.dispose()
    asyncio.run(scenario())
