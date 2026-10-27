# [test] 배송지 실제 PostgreSQL 통합 테스트 (옵트인: P3_RUN_POSTGRES_TESTS=1)
# 쓰고 버리는 전용 컨테이너에서만 실행한다. 개인 로컬 DB·공용 DB는 건드리지 않는다.
import asyncio
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from orders.application.address_service import AddressService
from orders.domain.address import AddressInput
from orders.domain.exceptions import AddressAccessDenied
from orders.infrastructure.address_repository import AddressRepository
from orders.infrastructure.transaction import SessionTransaction


def content(name: str) -> AddressInput:
    return AddressInput(recipient_name=name, recipient_phone="010-1234-5678",
                        postal_code="06236", address1="서울 강남구 테헤란로 1")


async def _setup(url: str):
    engine = create_async_engine(url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    me, other = uuid4(), uuid4()
    async with factory() as session:
        for user_id, email in ((me, "me@test.local"), (other, "other@test.local")):
            await session.execute(
                text("INSERT INTO users (id, email, nickname, password_hash) VALUES (:id, :email, '테스트', 'x')"),
                {"id": user_id, "email": email},
            )
        await session.commit()
    return engine, factory, me, other


async def _defaults(factory, user_id: UUID) -> list[int]:
    async with factory() as session:
        rows = await session.execute(
            text("SELECT id FROM addresses WHERE user_id = :u AND is_default ORDER BY id"), {"u": user_id})
        return [r[0] for r in rows]


async def _call(factory, method: str, *args):
    """요청 한 번처럼: 새 세션 → 서비스 호출 → 세션 종료."""
    async with factory() as session:
        service = AddressService(AddressRepository(session), SessionTransaction(session))
        return await getattr(service, method)(*args)


def test_default_address_flow_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, _ = await _setup(postgres_url)
        try:
            first = await _call(factory, "create", me, content("첫째"), False)
            second = await _call(factory, "create", me, content("둘째"), False)
            third = await _call(factory, "create", me, content("셋째"), True)
            assert first.is_default and not second.is_default
            assert await _defaults(factory, me) == [third.id]  # 새 기본이 기존 기본을 대신함

            await _call(factory, "set_default", me, second.id)
            assert await _defaults(factory, me) == [second.id]

            await _call(factory, "delete", me, second.id)  # 기본 삭제 → 남은 것 중 최신(셋째)
            assert await _defaults(factory, me) == [third.id]

            items, total = await _call(factory, "list", me, None, 1, 20)
            assert total == 2 and items[0].id == third.id
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_other_user_cannot_touch_address_on_real_db(postgres_url):
    async def scenario():
        engine, factory, me, other = await _setup(postgres_url)
        try:
            mine = await _call(factory, "create", me, content("내 것"), False)
            with pytest.raises(AddressAccessDenied):
                await _call(factory, "delete", other, mine.id)
            assert await _defaults(factory, me) == [mine.id]
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_failure_after_clearing_default_rolls_back(postgres_url):
    """기존 기본 해제 후 저장이 실패하면, 해제도 함께 취소돼 기본 배송지가 그대로 남아야 한다."""

    class BrokenRepository(AddressRepository):
        async def add(self, user_id, content, is_default):
            raise RuntimeError("저장 중 장애")

    async def scenario():
        engine, factory, me, _ = await _setup(postgres_url)
        try:
            first = await _call(factory, "create", me, content("첫째"), False)
            async with factory() as session:
                service = AddressService(BrokenRepository(session), SessionTransaction(session))
                with pytest.raises(RuntimeError):
                    await service.create(me, content("실패"), True)
            assert await _defaults(factory, me) == [first.id]
            _, total = await _call(factory, "list", me, None, 1, 20)
            assert total == 1
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_concurrent_first_addresses_make_exactly_one_default(postgres_url):
    """같은 사람이 첫 배송지를 동시에 여러 번 등록해도 모두 저장되고 기본은 1개여야 한다."""

    async def scenario():
        engine, factory, me, _ = await _setup(postgres_url)
        try:
            results = await asyncio.gather(
                *(_call(factory, "create", me, content(f"동시{i}"), False) for i in range(5)),
                return_exceptions=True,
            )
            errors = [r for r in results if isinstance(r, BaseException)]
            assert errors == []
            assert len(await _defaults(factory, me)) == 1
            _, total = await _call(factory, "list", me, None, 1, 20)
            assert total == 5
        finally:
            await engine.dispose()

    asyncio.run(scenario())
