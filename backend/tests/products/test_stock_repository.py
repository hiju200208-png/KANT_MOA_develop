import asyncio
from contextlib import asynccontextmanager
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from products.domain.variant import InsufficientStock
from products.infrastructure.models import ArtistModel, CategoryModel, ProductModel, ProductVariantModel
from products.infrastructure.repositories import ProductRepository


@asynccontextmanager
async def database(url):
    engine = create_async_engine(url)
    try:
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()


async def seed(session_factory, stock=5):
    async with session_factory() as session:
        slug = uuid4().hex
        artist = ArtistModel(name="TEST", name_ko="테스트", slug=slug)
        category = CategoryModel(name="앨범", slug=slug)
        session.add_all([artist, category])
        await session.flush()
        product = ProductModel(artist_id=artist.id, category_id=category.id, name="테스트 상품", price=1000)
        session.add(product)
        await session.flush()
        variants = [ProductVariantModel(product_id=product.id, option_name=name, stock=stock)
                    for name in ("A", "B")]
        session.add_all(variants)
        await session.commit()
        return [variant.id for variant in variants]


def test_lock_order_missing_ids_save_and_rollback(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                repository = ProductRepository(session)
                assert await repository.get_variants_for_update([]) == []
                with pytest.raises(ValueError):
                    await repository.get_variants_for_update([True])
                variants = await repository.get_variants_for_update([ids[1], ids[0], ids[0], 999999])
                assert [variant.id for variant in variants] == ids
                variants[0].decrease_stock(3)
                await repository.save_variant(variants[0])
                assert await session.scalar(select(ProductVariantModel.stock).where(ProductVariantModel.id == ids[0])) == 2
                # flush는 commit이 아니다. 다른 세션에는 원래 값이 보인다.
                async with factory() as observer:
                    assert await observer.scalar(select(ProductVariantModel.stock).where(ProductVariantModel.id == ids[0])) == 5
                await session.rollback()
                with pytest.raises(ValueError):
                    await repository.save_variant(variants[0])
                assert await session.scalar(select(ProductVariantModel.stock).where(ProductVariantModel.id == ids[0])) == 5
    asyncio.run(check())


async def wait_until_blocked(factory, pid):
    async with factory() as observer:
        async with asyncio.timeout(10):
            while not await observer.scalar(text("select cardinality(pg_blocking_pids(:pid)) > 0"), {"pid": pid}):
                await asyncio.sleep(0.02)


def test_concurrent_decrease_waits_and_reads_latest_stock(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as first, factory() as second:
                first_repo, second_repo = ProductRepository(first), ProductRepository(second)
                # 두 번째 세션의 identity map에 오래된 재고 5를 미리 보관한다.
                stale = await second.get(ProductVariantModel, ids[0])
                second_pid = await second.scalar(text("select pg_backend_pid()"))
                variant = (await first_repo.get_variants_for_update(ids))[0]
                variant.decrease_stock(4)
                await first_repo.save_variant(variant)
                pending = asyncio.create_task(second_repo.get_variants_for_update(reversed(ids)))
                try:
                    await wait_until_blocked(factory, second_pid)
                    assert not pending.done()
                    await first.commit()
                    locked = await asyncio.wait_for(pending, 10)
                    assert locked[0].stock == stale.stock == 1
                    with pytest.raises(InsufficientStock):
                        locked[0].decrease_stock(2)
                    await second.rollback()
                finally:
                    if not pending.done():
                        pending.cancel()
                        await asyncio.gather(pending, return_exceptions=True)
            async with factory() as observer:
                assert await observer.scalar(select(ProductVariantModel.stock).where(ProductVariantModel.id == ids[0])) == 1
    asyncio.run(check())


def test_rollback_releases_lock_and_concurrent_updates_are_not_lost(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as first, factory() as second:
                repo1, repo2 = ProductRepository(first), ProductRepository(second)
                variant = (await repo1.get_variants_for_update(ids))[0]
                variant.decrease_stock(5)
                await repo1.save_variant(variant)
                pid = await second.scalar(text("select pg_backend_pid()"))
                pending = asyncio.create_task(repo2.get_variants_for_update(ids))
                try:
                    await wait_until_blocked(factory, pid)
                    await first.rollback()
                    variant = (await asyncio.wait_for(pending, 10))[0]
                    assert variant.stock == 5
                    variant.increase_stock(2)
                    await repo2.save_variant(variant)
                    await second.commit()
                finally:
                    if not pending.done():
                        pending.cancel()
                        await asyncio.gather(pending, return_exceptions=True)

            async def decrease():
                async with factory() as session:
                    repo = ProductRepository(session)
                    variant = (await repo.get_variants_for_update(ids))[0]
                    variant.decrease_stock(1)
                    await repo.save_variant(variant)
                    await session.commit()

            await asyncio.gather(*(decrease() for _ in range(7)))
            async with factory() as observer:
                assert await observer.scalar(select(ProductVariantModel.stock).where(ProductVariantModel.id == ids[0])) == 0
    asyncio.run(check())
