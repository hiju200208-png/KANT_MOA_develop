"""판매 상태 변경 저장 + 세션 트랜잭션 연결 (commit은 서비스가 이 어댑터로만 호출).

P2 ORM 모델(ProductModel)로 status 컬럼만 바꾼다 (재고 미변경, 10/26 상재님 확인).
P2 상품 저장소에 상태 변경 함수가 생기면 그 함수를 쓰도록 이 어댑터만 바꾼다.
"""

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from products.infrastructure.models import ProductModel


class SqlProductStatusWriter:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def update_status(self, product_id: int, status: str) -> bool:
        result = await self._session.execute(
            update(ProductModel)
            .where(ProductModel.id == product_id)
            .values(status=status)
            .returning(ProductModel.id)
            .execution_options(synchronize_session=False)
        )
        return result.scalar_one_or_none() is not None


class SessionTransaction:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
