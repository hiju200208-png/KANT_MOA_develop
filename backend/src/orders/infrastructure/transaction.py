# [infrastructure] 요청 세션의 commit/rollback을 응용 서비스에 넘겨주는 얇은 연결. 언제 부를지는 서비스가 정한다.
from sqlalchemy.ext.asyncio import AsyncSession


class SessionTransaction:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
