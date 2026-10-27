"""실행 앱 → 상품 서비스 → 실제 PostgreSQL. 전용 Docker DB에서만 실행한다."""

import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy import event, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from database import get_session
from main import app
from products.infrastructure.models import (
    ArtistModel, CategoryModel, ProductImageModel, ProductModel, ProductVariantModel,
)
from products.infrastructure.seed import load_catalog, seed_catalog


@asynccontextmanager
async def catalog_client(postgres_url, *, original=False):
    engine = create_async_engine(postgres_url)
    previous_overrides = app.dependency_overrides.copy()
    try:
        async with engine.connect() as connection:
            transaction = await connection.begin()
            async with async_sessionmaker(connection, expire_on_commit=False)() as session:
                if original:
                    await seed_catalog(session)
                    ids = None
                else:
                    ids = await sample_catalog(session)

                async def local_session():
                    yield session

                app.dependency_overrides[get_session] = local_session
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app), base_url="http://test",
                ) as client:
                    # GET 흐름이 flush/commit으로 DB를 변경하지 않는지도 확인한다.
                    with patch.object(session, "commit", new_callable=AsyncMock) as commit:
                        with patch.object(session, "flush", new_callable=AsyncMock) as flush:
                            yield client, session, ids, engine
                            commit.assert_not_awaited()
                            flush.assert_not_awaited()
            await transaction.rollback()
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        await engine.dispose()


async def sample_catalog(session):
    a = ArtistModel(name="ALPHA", name_ko="알파", slug="alpha")
    b = ArtistModel(name="BETA", name_ko="베타", slug="beta")
    c = CategoryModel(name="음반", slug="album", sort_order=0)
    d = CategoryModel(name="의류", slug="clothes", sort_order=0)
    inactive = CategoryModel(name="비활성", slug="inactive", is_active=False)
    session.add_all([a, b, c, d, inactive])
    await session.flush()
    at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    definitions = [
        (a, c, r"100%_한정\앨범", 100, "on_sale", at),
        (a, c, "일반 앨범", 100, "on_sale", at),
        (a, d, "판매자가 품절 처리", 200, "sold_out", at + timedelta(days=1)),
        (b, d, "옵션 없는 상품", 50, "on_sale", at),
        (b, c, "숨긴 비밀 상품", 900, "hidden", at + timedelta(days=2)),
        (b, c, "동일 가격 기본 옵션", 100, "on_sale", at),
    ]
    products = [ProductModel(
        artist_id=artist.id, category_id=category.id, name=name, price=price,
        status=status, created_at=created_at, thumbnail_path="/static/products/example.webp",
        description="상품 설명", is_limited=True, is_preorder=True,
        release_date=date(2026, 2, 1),
    ) for artist, category, name, price, status, created_at in definitions]
    session.add_all(products)
    await session.flush()
    one, two, three, four, hidden, six = products
    session.add_all([
        ProductVariantModel(product_id=one.id, option_name="B", stock=0, sort_order=1),
        ProductVariantModel(product_id=one.id, option_name="A", stock=3, extra_price=25,
                            max_per_user=None, sort_order=0),
        ProductVariantModel(product_id=two.id, stock=0),
        ProductVariantModel(product_id=three.id, stock=8),
        ProductVariantModel(product_id=hidden.id, stock=99),
        ProductVariantModel(product_id=six.id, stock=1),
        ProductImageModel(product_id=one.id, kind="detail", image_path="/static/detail-2.webp", sort_order=2),
        ProductImageModel(product_id=one.id, kind="gallery", image_path="/static/gallery-1.webp", sort_order=0),
        ProductImageModel(product_id=one.id, kind="detail", image_path="/static/detail-1.webp", sort_order=1),
        ProductImageModel(product_id=one.id, kind="gallery", image_path="/static/gallery-2.webp", sort_order=0),
    ])
    await session.flush()
    return [p.id for p in products]


@pytest.mark.parametrize("sort,positions", [
    ("latest", [2, 5, 3, 1, 0]),
    ("price_asc", [3, 0, 1, 5, 2]),
    ("price_desc", [2, 0, 1, 5, 3]),
])
def test_stable_sort_total_and_last_page(postgres_url, sort, positions):
    async def check():
        async with catalog_client(postgres_url) as (client, _, ids, _):
            expected = [ids[i] for i in positions]
            seen = []
            for page in range(1, 5):
                response = await client.get("/products", params={"sort": sort, "page": page, "size": 2})
                assert response.status_code == 200
                body = response.json()
                assert (body["total"], body["page"], body["size"]) == (5, page, 2)
                assert [p["id"] for p in body["items"]] == expected[(page - 1) * 2:page * 2]
                seen += [p["id"] for p in body["items"]]
            assert seen == expected
    asyncio.run(check())


@pytest.mark.parametrize("query,positions", [
    ({}, [2, 5, 3, 1, 0]),
    ({"q": "  aLpHa  "}, [2, 1, 0]),
    ({"q": "알파"}, [2, 1, 0]),
    ({"q": "한정"}, [0]),
    ({"q": "%"}, [0]),
    ({"q": "_"}, [0]),
    ({"q": "\\"}, [0]),
    ({"q": "' OR 1=1 --"}, []),
    ({"q": ""}, []),
    ({"q": "   "}, []),
    ({"q": "숨긴"}, []),
    ({"artist": "alpha", "category": "album", "q": "앨범"}, [1, 0]),
    ({"artist": "beta", "category": "album"}, [5]),
    ({"artist": "missing"}, []),
    ({"category": "missing"}, []),
    ({"q": "x" * 100}, []),
])
def test_search_and_combined_filters(postgres_url, query, positions):
    async def check():
        async with catalog_client(postgres_url) as (client, _, ids, _):
            response = await client.get("/products", params=query)
            assert response.status_code == 200
            body = response.json()
            assert body["total"] == len(positions)
            assert [p["id"] for p in body["items"]] == [ids[i] for i in positions]
            response = await client.get("/products", params={**query, "exclude_id": ids[0], "size": 1})
            expected = [ids[i] for i in positions if i != 0]
            assert response.json()["total"] == len(expected)
            assert [p["id"] for p in response.json()["items"]] == expected[:1]
    asyncio.run(check())


@pytest.mark.parametrize("path", [
    "/products?page=0", "/products?page=-1", "/products?page=2147483648",
    "/products?size=0", "/products?size=101", "/products?page=abc",
    "/products?sort=random", "/products?exclude_id=0",
    "/products?exclude_id=9223372036854775808", "/products?q=" + "x" * 101,
    "/products/0", "/products/-1", "/products/abc", "/products/9223372036854775808",
], ids=["page-zero", "page-negative", "page-overflow", "size-zero", "size-large", "page-text",
        "sort", "exclude-zero", "exclude-overflow", "query-long", "id-zero", "id-negative", "id-text", "id-overflow"])
def test_invalid_queries_use_common_error(postgres_url, path):
    async def check():
        async with catalog_client(postgres_url) as (client, _, _, _):
            response = await client.get(path)
            assert response.status_code == 422
            assert response.json() == {"code": "UNKNOWN", "message": "입력 형식을 확인해주세요."}
    asyncio.run(check())


def test_detail_images_options_sold_out_and_no_writes(postgres_url):
    async def check():
        async with catalog_client(postgres_url) as (client, session, ids, _):
            before = (await session.execute(select(ProductModel.id, ProductModel.status))).all()
            response = await client.get(f"/products/{ids[0]}")
            assert response.status_code == 200
            body = response.json()
            assert body["artist"] == {"slug": "alpha", "name": "ALPHA", "name_ko": "알파"}
            assert body["category"] == {"slug": "album", "name": "음반"}
            assert body["description"] == "상품 설명"
            assert body["thumbnail_path"] == "/static/products/example.webp"
            assert body["is_limited"] and body["is_preorder"] and body["has_options"]
            assert body["release_date"] == "2026-02-01"
            assert body["gallery_paths"] == ["/static/gallery-1.webp", "/static/gallery-2.webp"]
            assert body["detail_paths"] == ["/static/detail-1.webp", "/static/detail-2.webp"]
            assert [(v["option_name"], v["extra_price"], v["price"], v["stock"], v["max_per_user"], v["is_sold_out"])
                    for v in body["variants"]] == [("A", 25, 125, 3, None, False), ("B", 0, 100, 0, 4, True)]
            assert not body["is_sold_out"]
            for position in [1, 2, 3, 5]:
                result = await client.get(f"/products/{ids[position]}")
                assert result.status_code == 200
                assert result.json()["is_sold_out"] is (position != 5)
            assert not (await client.get(f"/products/{ids[5]}")).json()["has_options"]
            hidden = await client.get(f"/products/{ids[4]}")
            absent = await client.get("/products/9223372036854775807")
            assert hidden.status_code == absent.status_code == 404
            assert hidden.json() == absent.json() == {"code": "UNKNOWN", "message": "상품을 찾을 수 없어요."}
            assert (await session.execute(select(ProductModel.id, ProductModel.status))).all() == before
            assert await session.scalar(select(ProductVariantModel.stock).where(ProductVariantModel.product_id == ids[2])) == 8
    asyncio.run(check())


def test_categories_openapi_and_batched_queries(postgres_url):
    async def check():
        async with catalog_client(postgres_url) as (client, _, ids, engine):
            response = await client.get("/categories")
            assert response.status_code == 200
            assert [c["slug"] for c in response.json()] == ["album", "clothes"]
            schema = (await client.get("/openapi.json")).json()
            docs = await client.get("/docs")
            assert docs.status_code == 200 and "SwaggerUIBundle" in docs.text
            for path in ["/products", "/products/{product_id}", "/categories"]:
                assert "get" in schema["paths"][path]
                assert not schema["paths"][path]["get"].get("security")
            queries = []

            def capture(conn, cursor, statement, parameters, context, executemany):
                queries.append(statement)

            event.listen(engine.sync_engine, "before_cursor_execute", capture)
            for size in [1, 100]:
                queries.clear()
                assert (await client.get("/products", params={"size": size})).status_code == 200
                assert len(queries) == 3  # count + 상품/아티스트/분류 JOIN + 옵션 일괄 조회
                assert all(q.lstrip().upper().startswith("SELECT") and "FOR UPDATE" not in q.upper() for q in queries)
            queries.clear()
            assert (await client.get(f"/products/{ids[0]}")).status_code == 200
            assert len(queries) == 3  # 상품/아티스트/분류 JOIN + 옵션 + 이미지 일괄 조회
    asyncio.run(check())


def test_original_catalog_all_pages_and_details(postgres_url, original_images):
    async def check():
        snapshot = load_catalog()["tables"]
        expected = sorted((p for p in snapshot["products"] if p["status"] != "hidden"), key=lambda p: p["id"])
        async with catalog_client(postgres_url, original=True) as (client, session, _, _):
            all_items = []
            for page in range(1, 6):
                response = await client.get("/products", params={"page": page, "size": 100, "sort": "price_asc"})
                assert response.status_code == 200
                assert response.json()["total"] == 387
                all_items.extend(response.json()["items"])
            assert [p["id"] for p in all_items] == [p["id"] for p in sorted(expected, key=lambda p: (p["price"], p["id"]))]
            assert len({p["id"] for p in all_items}) == 387
            for product in expected:
                response = await client.get(f'/products/{product["id"]}')
                assert response.status_code == 200
                body = response.json()
                assert (body["name"], body["price"], body["status"]) == (product["name"], product["price"], product["status"])
                options = sorted((v for v in snapshot["product_variants"] if v["product_id"] == product["id"]),
                                 key=lambda v: (v["sort_order"], v["id"]))
                assert [v["id"] for v in body["variants"]] == [v["id"] for v in options]
                assert [v["price"] for v in body["variants"]] == [product["price"] + v["extra_price"] for v in options]
                assert body["is_sold_out"] == (product["status"] == "sold_out" or not any(v["stock"] > 0 for v in options))
                images = sorted((i for i in snapshot["product_images"] if i["product_id"] == product["id"]),
                                key=lambda i: (i["sort_order"], i["id"]))
                for kind in ["gallery", "detail"]:
                    assert body[kind + "_paths"] == [i["image_path"] for i in images if i["kind"] == kind]
            for product in snapshot["products"]:
                if product["status"] == "hidden":
                    assert (await client.get(f'/products/{product["id"]}')).status_code == 404
            assert await session.scalar(text("SELECT count(*) FROM products WHERE status='on_sale'")) == 387
    asyncio.run(check())
