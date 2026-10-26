import asyncio
from contextlib import asynccontextmanager
from dataclasses import replace
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from products.domain.variant import InsufficientStock, InvalidStock
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


def test_nullable_purchase_limit_and_option_fields_round_trip(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                existing = await session.get(ProductVariantModel, ids[0])
                variant = ProductVariantModel(
                    product_id=existing.product_id, option_name="무제한", extra_price=1500,
                    stock=9, max_per_user=None, sort_order=7,
                )
                session.add(variant)
                await session.commit()
                repo = ProductRepository(session)
                loaded = (await repo.get_variants_for_update([variant.id]))[0]
                assert (loaded.option_name, loaded.extra_price, loaded.stock,
                        loaded.max_per_user, loaded.sort_order) == ("무제한", 1500, 9, None, 7)
                loaded.decrease_stock(1)
                await repo.save_variant(loaded)
                await session.commit()
                await session.refresh(variant)
                assert variant.stock == 8 and variant.max_per_user is None

    asyncio.run(check())


def test_rejects_unlocked_objects_and_previous_transaction(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                repo = ProductRepository(session)
                variant = (await repo.get_variants_for_update(ids))[0]
                with pytest.raises(ValueError):
                    await repo.save_variant(replace(variant))
                with pytest.raises(ValueError):
                    await ProductRepository(session).save_variant(variant)
                await session.commit()
                # 새 root transaction이 열려 있어도 예전 잠금은 유효하지 않다.
                await session.execute(text("select 1"))
                with pytest.raises(ValueError):
                    await repo.save_variant(variant)

    asyncio.run(check())


def test_savepoint_rollback_invalidates_lock_before_root_commit(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                await session.begin()
                repo = ProductRepository(session)
                savepoint = await session.begin_nested()
                variant = (await repo.get_variants_for_update(ids))[0]
                await savepoint.rollback()
                # root transaction은 살아 있어도 savepoint에서 얻은 행 잠금은 풀렸다.
                variant.decrease_stock(1)
                with pytest.raises(ValueError):
                    await repo.save_variant(variant)

    asyncio.run(check())


def test_partial_save_then_later_option_failure_rolls_back_everything(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                repo = ProductRepository(session)
                variants = await repo.get_variants_for_update(ids)
                try:
                    variants[0].decrease_stock(2)
                    await repo.save_variant(variants[0])
                    variants[1].decrease_stock(6)
                except InsufficientStock:
                    await session.rollback()
                else:
                    pytest.fail("두 번째 옵션에서 재고 부족이어야 한다")
            async with factory() as observer:
                stocks = list(await observer.scalars(
                    select(ProductVariantModel.stock).where(ProductVariantModel.id.in_(ids))
                    .order_by(ProductVariantModel.id)
                ))
                assert stocks == [5, 5]

    asyncio.run(check())


def test_database_acquires_lower_id_before_waiting_on_higher_id(postgres_url):
    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as blocker, factory() as waiter, factory() as probe:
                await ProductRepository(blocker).get_variants_for_update([ids[1]])
                waiter_pid = await waiter.scalar(text("select pg_backend_pid()"))
                probe_pid = await probe.scalar(text("select pg_backend_pid()"))
                pending = asyncio.create_task(
                    ProductRepository(waiter).get_variants_for_update([ids[1], ids[0], ids[1]])
                )
                probing = None
                try:
                    await wait_until_blocked(factory, waiter_pid)
                    probing = asyncio.create_task(
                        ProductRepository(probe).get_variants_for_update([ids[0]])
                    )
                    await wait_until_blocked(factory, probe_pid)
                    async with factory() as observer:
                        blockers = await observer.scalar(
                            text("select pg_blocking_pids(:pid)"), {"pid": probe_pid}
                        )
                        assert waiter_pid in blockers
                    # 높은 ID를 기다리는 동안 이미 낮은 ID를 잠근 사실을 검증했다.
                    await blocker.rollback()
                    assert [v.id for v in await asyncio.wait_for(pending, 10)] == ids
                    assert not probing.done()
                    await waiter.commit()
                    assert [v.id for v in await asyncio.wait_for(probing, 10)] == [ids[0]]
                finally:
                    for task in (pending, probing):
                        if task is not None and not task.done():
                            task.cancel()
                    await asyncio.gather(*(task for task in (pending, probing) if task is not None),
                                         return_exceptions=True)

    asyncio.run(check())


class ExampleAdminStockAdapter:
    """P4가 사용할 연결 예시를 검증한다. 운영 adapter 구현을 대신하지 않는다."""

    def __init__(self, session):
        self.repository = ProductRepository(session)

    async def lock_variant(self, variant_id):
        variants = await self.repository.get_variants_for_update([variant_id])
        return variants[0] if variants else None

    async def increase_stock(self, variant, quantity):
        from admin.domain.stock_adjustment import InvalidStockAdjustment
        try:
            stock = variant.increase_stock(quantity)
        except InvalidStock as error:
            raise InvalidStockAdjustment(str(error)) from error
        await self.repository.save_variant(variant)
        return stock

    async def decrease_stock(self, variant, quantity):
        from admin.domain.stock_adjustment import InsufficientStock as AdminInsufficientStock
        from admin.domain.stock_adjustment import InvalidStockAdjustment
        try:
            stock = variant.decrease_stock(quantity)
        except InsufficientStock as error:
            raise AdminInsufficientStock(str(error)) from error
        except InvalidStock as error:
            raise InvalidStockAdjustment(str(error)) from error
        await self.repository.save_variant(variant)
        return stock


@pytest.mark.parametrize("change,expected", [(2, 7), (-2, 3), (-6, 5)])
def test_p4_service_uses_same_session_and_maps_stock_error(postgres_url, change, expected):
    from admin.application.stock_service import AdminStockService
    from admin.domain.stock_adjustment import InsufficientStock as AdminInsufficientStock
    from admin.domain.stock_adjustment import StockAdjustment
    from admin.presentation.errors import to_api_error

    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                product_id = await session.scalar(
                    select(ProductVariantModel.product_id).where(ProductVariantModel.id == ids[0])
                )
                service = AdminStockService(ExampleAdminStockAdapter(session), session)
                if change == -6:
                    with pytest.raises(AdminInsufficientStock) as caught:
                        await service.adjust(product_id, ids[0], StockAdjustment(change))
                    assert to_api_error(caught.value).status_code == 409
                else:
                    result = await service.adjust(product_id, ids[0], StockAdjustment(change))
                    assert (result.before, result.after, result.change) == (5, expected, change)
                assert not session.in_transaction()
            async with factory() as observer:
                assert await observer.scalar(
                    select(ProductVariantModel.stock).where(ProductVariantModel.id == ids[0])
                ) == expected

    asyncio.run(check())


@pytest.mark.parametrize("missing", [True, False])
def test_p4_service_missing_or_wrong_product_rolls_back(postgres_url, missing):
    from admin.application.stock_service import AdminStockService
    from admin.domain.stock_adjustment import StockAdjustment, VariantNotFound
    from admin.presentation.errors import to_api_error

    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                service = AdminStockService(ExampleAdminStockAdapter(session), session)
                with pytest.raises(VariantNotFound) as caught:
                    await service.adjust(999999, 999999 if missing else ids[0], StockAdjustment(2))
                assert to_api_error(caught.value).status_code == 404
                assert not session.in_transaction()
            async with factory() as observer:
                assert await observer.scalar(
                    select(ProductVariantModel.stock).where(ProductVariantModel.id == ids[0])
                ) == 5

    asyncio.run(check())


def test_p4_example_maps_invalid_quantity_without_saving(postgres_url):
    from admin.domain.stock_adjustment import InvalidStockAdjustment
    from admin.presentation.errors import to_api_error

    async def check():
        async with database(postgres_url) as factory:
            ids = await seed(factory)
            async with factory() as session:
                adapter = ExampleAdminStockAdapter(session)
                variant = await adapter.lock_variant(ids[0])
                with pytest.raises(InvalidStockAdjustment) as caught:
                    await adapter.increase_stock(variant, 0)
                assert to_api_error(caught.value).status_code == 422
                assert variant.stock == 5
                await session.rollback()

    asyncio.run(check())
