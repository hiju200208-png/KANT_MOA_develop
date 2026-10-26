"""로컬 Docker DB 통합 테스트 (기본은 건너뜀).

실행: $env:ADMIN_DB_TEST="1"; uv run --no-sync pytest tests/admin/test_admin_product_db.py -q
- backend/.env의 DATABASE_URL(로컬 DB)을 쓴다. 공용 서버 DB에는 절대 실행하지 않는다.
- 테스트 데이터는 하나의 트랜잭션 안에서 넣고 끝나면 항상 rollback 한다 (DB에 남지 않음).
"""

import asyncio
import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(os.environ.get("ADMIN_DB_TEST") != "1", reason="ADMIN_DB_TEST=1 일 때만 실행")

from core.config import BACKEND_ROOT  # noqa: E402


def _local_database_url() -> str:
    for line in (BACKEND_ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip()
            if "localhost" not in url and "127.0.0.1" not in url:
                pytest.skip("로컬 DB가 아니면 실행하지 않아요.")
            return url
    pytest.skip("backend/.env에 DATABASE_URL이 없어요.")


async def _scenario():
    import httpx
    from fastapi import FastAPI
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.pool import NullPool

    from admin.presentation.dependencies import require_admin
    from admin.presentation.router import router
    from core.errors import register_error_handlers
    from database import get_session

    tag = uuid.uuid4().hex[:8]
    engine = create_async_engine(_local_database_url(), poolclass=NullPool)
    async with engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")
        try:
            artist_id = (await session.execute(text(
                "INSERT INTO artists (name, name_ko, slug) VALUES ('TEST', '테스트', :s) RETURNING id"
            ), {"s": f"test-{tag}"})).scalar_one()
            category_id = (await session.execute(text(
                "INSERT INTO categories (name, slug) VALUES ('테스트분류', :s) RETURNING id"
            ), {"s": f"cat-{tag}"})).scalar_one()

            async def product(name, status, stocks, created):
                pid = (await session.execute(text(
                    "INSERT INTO products (artist_id, category_id, name, price, status, thumbnail_path, created_at) "
                    "VALUES (:a, :c, :n, 10000, :st, :t, now() - make_interval(mins => :m)) RETURNING id"
                ), {"a": artist_id, "c": category_id, "n": name, "st": status, "t": f"test/{name}.png", "m": created}
                )).scalar_one()
                for i, stock in enumerate(stocks):
                    await session.execute(text(
                        "INSERT INTO product_variants (product_id, option_name, stock, sort_order) "
                        "VALUES (:p, :o, :s, :i)"
                    ), {"p": pid, "o": f"옵션{i}", "s": stock, "i": i})
                return pid

            on_sale = await product("응원봉_A", "on_sale", [10, 7], 4)
            empty = await product("포토카드", "on_sale", [0, 0], 3)
            hidden = await product("응원봉 숨김", "hidden", [3], 2)
            manual = await product("키링", "sold_out", [8], 1)

            async def fake_admin():
                return None

            async def same_session():
                yield session

            app = FastAPI()
            register_error_handlers(app)
            app.include_router(router)
            app.dependency_overrides[require_admin] = fake_admin
            app.dependency_overrides[get_session] = same_session

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                base = {"artist": f"test-{tag}"}
                listed = (await client.get("/admin/products", params=base)).json()
                by_name = {i["name"]: i for i in listed["items"]}
                assert listed["total"] == 4
                assert [i["id"] for i in listed["items"]] == [manual, hidden, empty, on_sale]
                assert by_name["응원봉_A"]["total_stock"] == 17 and not by_name["응원봉_A"]["is_sold_out"]
                assert by_name["포토카드"]["is_sold_out"] and by_name["포토카드"]["status"] == "on_sale"
                assert by_name["응원봉 숨김"]["status"] == "hidden"
                assert by_name["키링"]["is_sold_out"] and by_name["키링"]["total_stock"] == 8

                async def ids(**params):
                    body = (await client.get("/admin/products", params={**base, **params})).json()
                    return [i["id"] for i in body["items"]], body["total"]

                assert await ids(q="응원봉") == ([hidden, on_sale], 2)
                assert await ids(q="_A") == ([on_sale], 1)  # _ 는 와일드카드가 아님
                assert await ids(status="hidden") == ([hidden], 1)
                assert await ids(stock="out") == ([empty], 1)
                assert await ids(stock="low") == ([hidden, empty], 2)
                assert (await ids(sort="stock_asc"))[0] == [empty, hidden, manual, on_sale]
                assert await ids(size=2, page=2) == ([empty, on_sale], 4)

                detail = await client.get(f"/admin/products/{on_sale}")
                assert detail.status_code == 200
                body = detail.json()
                assert [v["option_name"] for v in body["variants"]] == ["옵션0", "옵션1"]
                assert body["thumbnail_url"] == "/static/products/test/응원봉_A.png"

                # 판매 상태 변경: 서비스 commit은 savepoint까지만, 바깥 트랜잭션 rollback으로 모두 취소
                changed = await client.patch(f"/admin/products/{on_sale}", json={"status": "hidden"})
                assert changed.status_code == 200 and changed.json()["status"] == "hidden"
                assert (await ids(status="hidden"))[0] == [hidden, on_sale]
                reopened = await client.patch(f"/admin/products/{empty}", json={"status": "on_sale"})
                assert reopened.json()["is_sold_out"] is True  # 재고 0이면 on_sale이어도 품절 표시
                assert (await client.patch("/admin/products/999999999", json={"status": "hidden"})).status_code == 404
                assert (await client.patch(f"/admin/products/{on_sale}", json={"status": "x"})).status_code == 422

                missing = await client.get("/admin/products/999999999")
                assert missing.status_code == 404
                assert (await client.get("/admin/products?size=0")).status_code == 422
        finally:
            await session.close()
            await trans.rollback()
        left = (await conn.execute(text("SELECT count(*) FROM artists WHERE slug = :s"), {"s": f"test-{tag}"})).scalar_one()
        assert left == 0
    await engine.dispose()


def test_admin_product_queries_against_local_db():
    asyncio.run(_scenario())
