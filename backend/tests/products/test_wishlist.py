"""P1 실제 인증 + 실행 앱 + 전용 로컬 PostgreSQL의 찜 계약 검증."""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from auth.infrastructure.models import TokenBlacklistModel, UserModel
from auth.infrastructure.security import create_access_token, decode_access_token
from core.config import get_settings
from database import get_session
from main import app
from products.application.wishlist_service import WishlistService
from products.domain.product import ProductNotFound
from products.infrastructure.models import ArtistModel, CategoryModel, ProductModel, ProductVariantModel, WishlistModel
from products.infrastructure.wishlist import WishlistRepository


@asynccontextmanager
async def wishlist_client(url):
    engine = create_async_engine(url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    overrides = app.dependency_overrides.copy()
    users, product_ids, jtis = [], [], []
    artist_id = category_id = None

    async def local_session():
        async with factory() as session:
            try:
                yield session
            finally:
                if session.in_transaction():
                    await session.rollback()

    app.dependency_overrides[get_session] = local_session
    try:
        async with factory() as session:
            slug = uuid4().hex
            artist = ArtistModel(name="WISHLIST", name_ko="찜 테스트", slug=slug)
            category = CategoryModel(name="앨범", slug=slug)
            session.add_all([artist, category])
            await session.flush()
            artist_id, category_id = artist.id, category.id
            products = [ProductModel(artist_id=artist_id, category_id=category_id,
                                     name=name, price=100, status=status)
                        for name, status in [("판매중", "on_sale"), ("품절", "sold_out"), ("숨김", "hidden")]]
            session.add_all(products)
            await session.flush()
            product_ids = [p.id for p in products]
            session.add_all([ProductVariantModel(product_id=product_ids[0], option_name=name, stock=stock)
                             for name, stock in [("A", 2), ("B", 0)]])
            await session.commit()
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            for _ in range(2):
                email = "wishlist-" + uuid4().hex + "@example.com"
                created = await client.post("/auth/signup", json={"email": email, "nickname": "찜 테스트", "password": "Test-password-123!"})
                assert created.status_code == 201
                user_id = UUID(created.json()["id"])
                users.append({"id": user_id})
                login = await client.post("/auth/login", data={"username": email, "password": "Test-password-123!"})
                assert login.status_code == 200
                token = login.json()["access_token"]
                users[-1]["headers"] = {"Authorization": "Bearer " + token}
                jtis.append(decode_access_token(token).jti)
            yield client, factory, users, product_ids
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(overrides)
        async with factory() as session:
            await session.execute(delete(TokenBlacklistModel).where(TokenBlacklistModel.jti.in_(jtis)))
            await session.execute(delete(UserModel).where(UserModel.id.in_([u["id"] for u in users])))
            await session.execute(delete(ProductModel).where(ProductModel.id.in_(product_ids)))
            if artist_id is not None:
                await session.execute(delete(ArtistModel).where(ArtistModel.id == artist_id))
            if category_id is not None:
                await session.execute(delete(CategoryModel).where(CategoryModel.id == category_id))
            await session.commit()
        await engine.dispose()


async def entries(factory, user):
    async with factory() as session:
        return (await session.execute(select(WishlistModel.product_id, WishlistModel.created_at)
                                      .where(WishlistModel.user_id == user))).all()


def test_real_login_idempotence_ownership_and_hidden_policy(postgres_url):
    async def check():
        async with wishlist_client(postgres_url) as (client, factory, users, ids):
            a, b = users
            for user in users:
                assert (await client.get("/wishlist/ids", headers=user["headers"])).json() == []
            for _ in range(2):
                response = await client.put(f"/wishlist/{ids[0]}", headers=a["headers"],
                                            params={"user_id": str(b["id"])}, json={"user_id": str(b["id"])})
                assert response.status_code == 200
                assert response.json() == {"product_id": ids[0], "is_wished": True}
                saved = await entries(factory, a["id"])
                assert len(saved) == 1
                if _ == 0:
                    timestamp = saved[0].created_at
                else:
                    assert saved[0].created_at == timestamp  # 재추가로 최근 찜 순서를 바꾸지 않는다.
            assert await entries(factory, b["id"]) == []
            assert (await client.get("/wishlist", params={"user_id": str(b["id"])}, headers=a["headers"])).status_code == 422
            assert (await client.delete(f"/wishlist/{ids[0]}", headers=b["headers"])).status_code == 200
            assert len(await entries(factory, a["id"])) == 1
            for product_id in [ids[2], 9_223_372_036_854_775_807]:
                denied = await client.put(f"/wishlist/{product_id}", headers=a["headers"])
                assert denied.status_code == 404
                assert denied.json() == {"code": "UNKNOWN", "message": "상품을 찾을 수 없어요."}
            assert (await client.put(f"/wishlist/{ids[1]}", headers=a["headers"])).status_code == 200
            async with factory() as session:
                await session.execute(update(ProductModel).where(ProductModel.id == ids[0]).values(status="hidden"))
                await session.commit()
            visible = await client.get("/wishlist", headers=a["headers"])
            assert visible.status_code == 200 and visible.json()["total"] == 1
            assert visible.json()["items"][0]["id"] == ids[1]
            assert visible.json()["items"][0]["is_sold_out"] is True
            assert (await client.get("/wishlist/ids", headers=a["headers"])).json() == [ids[1]]
            for _ in range(2):
                removed = await client.delete(f"/wishlist/{ids[0]}", headers=a["headers"])
                assert removed.status_code == 200 and removed.json()["is_wished"] is False
            assert (await client.delete("/wishlist/9223372036854775807", headers=a["headers"])).status_code == 200
            assert [row.product_id for row in await entries(factory, a["id"])] == [ids[1]]
    asyncio.run(check())


def test_paging_recent_order_private_cache_and_read_only(postgres_url):
    async def check():
        async with wishlist_client(postgres_url) as (client, factory, users, ids):
            a = users[0]
            for product_id in ids[:2]:
                assert (await client.put(f"/wishlist/{product_id}", headers=a["headers"])).status_code == 200
            async with factory() as session:
                await session.execute(update(WishlistModel).where(WishlistModel.user_id == a["id"])
                                      .values(created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)))
                await session.commit()
            before = await entries(factory, a["id"])
            with patch.object(WishlistService, "set_wished", new_callable=AsyncMock) as write:
                for page, expected in [(1, [ids[1]]), (2, [ids[0]]), (3, [])]:
                    response = await client.get("/wishlist", headers=a["headers"], params={"page": page, "size": 1})
                    assert response.status_code == 200
                    assert response.headers["cache-control"] == "private, no-store"
                    assert (response.json()["total"], response.json()["page"], response.json()["size"]) == (2, page, 1)
                    assert [p["id"] for p in response.json()["items"]] == expected
                wished_ids = await client.get("/wishlist/ids", headers=a["headers"])
                assert wished_ids.headers["cache-control"] == "private, no-store"
                assert wished_ids.json() == [ids[1], ids[0]]
                write.assert_not_awaited()
            assert await entries(factory, a["id"]) == before
            other = await client.get("/wishlist", headers=users[1]["headers"])
            assert other.json() == {"items": [], "total": 0, "page": 1, "size": 20}
            schema = (await client.get("/openapi.json")).json()
            for path in ["/wishlist", "/wishlist/ids", "/wishlist/{product_id}"]:
                assert all(operation.get("security") for operation in schema["paths"][path].values())
    asyncio.run(check())


@pytest.mark.parametrize("token_kind", ["missing", "malformed", "expired", "wrong-signature", "logged-out", "deleted-user"])
def test_real_auth_rejects_invalid_tokens_for_every_wishlist_operation(postgres_url, token_kind):
    async def check():
        async with wishlist_client(postgres_url) as (client, factory, users, ids):
            a = users[0]
            headers = a["headers"]
            if token_kind == "missing":
                headers = {}
            elif token_kind == "malformed":
                headers = {"Authorization": "Bearer invalid-token"}
            elif token_kind in {"expired", "wrong-signature"}:
                changes = {"jwt_expire_minutes": -1} if token_kind == "expired" else {"jwt_secret": "wrong-secret-for-local-test-only-123456789"}
                with patch("auth.infrastructure.security.get_settings", return_value=get_settings().model_copy(update=changes)):
                    token = create_access_token(a["id"]).value
                headers = {"Authorization": "Bearer " + token}
            elif token_kind == "logged-out":
                assert (await client.post("/auth/logout", headers=headers)).status_code == 204
            elif token_kind == "deleted-user":
                async with factory() as session:
                    await session.execute(delete(UserModel).where(UserModel.id == a["id"]))
                    await session.commit()
            for method, path in [("GET", "/wishlist"), ("GET", "/wishlist/ids"), ("PUT", f"/wishlist/{ids[0]}"), ("DELETE", f"/wishlist/{ids[0]}")]:
                response = await client.request(method, path, headers=headers)
                assert response.status_code == 401
                assert response.json()["code"] == "NOT_AUTHENTICATED"
                assert response.headers["www-authenticate"] == "Bearer"
                assert "invalid-token" not in response.text
            assert await entries(factory, a["id"]) == []
    asyncio.run(check())


@pytest.mark.parametrize("path,method", [
    ("/wishlist?page=0", "GET"), ("/wishlist?size=101", "GET"),
    ("/wishlist?page=2147483648", "GET"), ("/wishlist/0", "PUT"),
    ("/wishlist/9223372036854775808", "DELETE"),
], ids=["page-zero", "size-large", "page-overflow", "id-zero", "id-overflow"])
def test_wishlist_validation(postgres_url, path, method):
    async def check():
        async with wishlist_client(postgres_url) as (client, _, users, _):
            response = await client.request(method, path, headers=users[0]["headers"])
            assert response.status_code == 422
            assert response.json() == {"code": "UNKNOWN", "message": "입력 형식을 확인해주세요."}
    asyncio.run(check())


def test_concurrent_requests_are_idempotent(postgres_url):
    async def check():
        async with wishlist_client(postgres_url) as (client, factory, users, ids):
            a = users[0]
            async def change(method):
                return await client.request(method, f"/wishlist/{ids[0]}", headers=a["headers"])
            adds = await asyncio.wait_for(asyncio.gather(*(change("PUT") for _ in range(8))), 20)
            assert all(r.status_code == 200 and r.json()["is_wished"] for r in adds)
            assert len(await entries(factory, a["id"])) == 1
            removals = await asyncio.wait_for(asyncio.gather(*(change("DELETE") for _ in range(8))), 20)
            assert all(r.status_code == 200 and not r.json()["is_wished"] for r in removals)
            assert await entries(factory, a["id"]) == []
            mixed = await asyncio.wait_for(asyncio.gather(*(change(method) for method in ["PUT", "DELETE"] * 4)), 20)
            assert all(r.status_code == 200 for r in mixed)
            assert len(await entries(factory, a["id"])) <= 1
            assert (await change("PUT")).status_code == 200
            assert len(await entries(factory, a["id"])) == 1
            assert (await change("DELETE")).status_code == 200
            assert await entries(factory, a["id"]) == []
    asyncio.run(check())


def test_foreign_key_failure_rolls_back_whole_service_transaction(postgres_url):
    async def check():
        async with wishlist_client(postgres_url) as (_, factory, users, ids):
            async with factory() as session:
                await session.execute(update(ProductModel).where(ProductModel.id == ids[0]).values(name="미커밋 수정"))
                with pytest.raises(IntegrityError) as error:
                    await WishlistService(session).set_wished(uuid4(), ids[0], wished=True)
                assert error.value.orig.sqlstate == "23503"  # FK 오류를 PK 중복 성공으로 처리하지 않는다.
                assert not session.in_transaction()
                assert await session.scalar(text("SELECT 1")) == 1
                assert await session.scalar(select(ProductModel.name).where(ProductModel.id == ids[0])) == "판매중"
                await WishlistService(session).set_wished(users[0]["id"], ids[0], wished=True)
            assert len(await entries(factory, users[0]["id"])) == 1
    asyncio.run(check())


def test_repository_never_commits_and_caller_can_rollback(postgres_url):
    async def check():
        async with wishlist_client(postgres_url) as (_, factory, users, ids):
            a = users[0]
            async with factory() as session:
                with patch.object(session, "commit", new_callable=AsyncMock) as commit, patch.object(session, "rollback", new_callable=AsyncMock) as rollback:
                    repo = WishlistRepository(session)
                    assert await repo.add(a["id"], ids[0])
                    assert await repo.ids(a["id"]) == [ids[0]]
                    assert await entries(factory, a["id"]) == []
                    await repo.remove(a["id"], ids[0])
                    assert await repo.add(a["id"], ids[1])
                    commit.assert_not_awaited()
                    rollback.assert_not_awaited()
                await session.rollback()
            assert await entries(factory, a["id"]) == []
    asyncio.run(check())


def test_product_status_change_waits_for_wishlist_transaction(postgres_url):
    async def check():
        async with wishlist_client(postgres_url) as (_, factory, users, ids):
            a = users[0]
            async with factory() as adding, factory() as changing, factory() as observer:
                blocker = await adding.scalar(text("SELECT pg_backend_pid()"))
                waiting = await changing.scalar(text("SELECT pg_backend_pid()"))
                assert await WishlistRepository(adding).add(a["id"], ids[0])
                async def hide():
                    await changing.execute(update(ProductModel).where(ProductModel.id == ids[0]).values(status="hidden"))
                    await changing.commit()
                task = asyncio.create_task(hide())
                try:
                    for _ in range(100):
                        blocked = await observer.scalar(text("SELECT :blocker = ANY(pg_blocking_pids(:waiting))"),
                                                        {"blocker": blocker, "waiting": waiting})
                        if blocked:
                            break
                        await asyncio.sleep(.025)
                    assert blocked and not task.done()
                    await adding.commit()
                    await asyncio.wait_for(task, 5)
                finally:
                    if not task.done():
                        task.cancel()
                        await asyncio.gather(task, return_exceptions=True)
                assert await WishlistRepository(observer).ids(a["id"]) == []
                with pytest.raises(ProductNotFound):
                    await WishlistService(observer).set_wished(a["id"], ids[0], wished=True)
                await WishlistService(observer).set_wished(a["id"], ids[0], wished=False)
            assert await entries(factory, a["id"]) == []
    asyncio.run(check())
