# [presentation] P3 API 의존성: 로그인 사용자와 요청마다 같은 세션을 쓰는 서비스를 만든다.
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.errors import ApiError
from database import get_session
from orders.application.address_service import AddressService
from orders.application.cart_service import CartService
from orders.infrastructure.address_repository import AddressRepository
from orders.infrastructure.cart_repository import CartRepository
from orders.infrastructure.transaction import SessionTransaction

try:  # P1 인증(PR #49)이 main에 들어오면 자동으로 실제 의존성을 쓴다.
    from auth.presentation.dependencies import get_current_user  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - P1 인증 통합 전
    # 인증이 없는 동안에는 아무도 통과시키지 않는다 (사용자 id를 요청에서 믿지 않기 위해).
    async def get_current_user():
        raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")


async def get_address_service(session: AsyncSession = Depends(get_session)) -> AddressService:
    return AddressService(AddressRepository(session), SessionTransaction(session))


async def get_cart_service(session: AsyncSession = Depends(get_session)) -> CartService:
    return CartService(CartRepository(session), SessionTransaction(session))
