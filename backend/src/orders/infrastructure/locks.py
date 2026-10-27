# [infrastructure] 같은 사람의 변경 요청을 한 줄로 세우는 잠금 (배송지·장바구니가 함께 쓴다)
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def lock_user(session: AsyncSession, user_id: UUID) -> None:
    """회원 행(users)을 FOR UPDATE로 잠근다. 트랜잭션이 끝날 때(commit/rollback) 풀린다.

    같은 사람이 동시에 두 요청을 보내면 뒤 요청은 앞 요청이 끝날 때까지 기다린다.
    예: 첫 배송지 동시 등록 → 기본 배송지 2개 시도로 UNIQUE 위반, 같은 옵션 동시 담기 → 수량 덮어쓰기.
    users는 P1 테이블이라 읽기 잠금만 하고 값은 바꾸지 않는다.
    """
    await session.execute(text("SELECT id FROM users WHERE id = :id FOR UPDATE"), {"id": user_id})
