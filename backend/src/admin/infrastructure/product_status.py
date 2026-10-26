"""판매 상태 변경 저장 + 세션 트랜잭션 연결 (commit은 서비스가 이 어댑터로만 호출).

P2 상품 저장소에 상태 변경 함수가 생기면 그 함수를 쓰도록 이 어댑터만 바꾼다.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class SqlProductStatusWriter:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def update_status(self, product_id: int, status: str) -> bool:
        result = await self._session.execute(
            text("UPDATE products SET status = :status WHERE id = :product_id RETURNING id"),
            {"status": status, "product_id": product_id},
        )
        return result.scalar_one_or_none() is not None


class SessionTransaction:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
