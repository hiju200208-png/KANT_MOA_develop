"""관리자 API 의존성.

- require_admin: P1 auth.presentation.dependencies.require_admin을 그대로 쓴다.
  P1 인증이 main에 들어오기 전에는 모든 요청을 401로 막는 대체 함수를 쓴다(접근 허용 없음).
- get_admin_stock_service: P2 재고 연결(VariantStockPort 구현)이 나오면 실제 서비스를 돌려준다.
  그 전에는 503으로 막는다. 테스트는 app.dependency_overrides로 바꿔 끼운다.
- get_admin_product_service: 요청마다 같은 AsyncSession으로 조회 전용 서비스를 만든다.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from admin.application.product_service import AdminProductService
from admin.infrastructure.product_queries import SqlAdminProductQueries
from core.errors import ApiError
from database import get_session

try:  # P1 인증 구현 후 자동으로 실제 의존성을 사용
    from auth.presentation.dependencies import require_admin  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - P1 인증 통합 전

    async def require_admin():
        raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")


async def get_admin_stock_service():
    raise ApiError(503, "UNKNOWN", "재고 연결을 준비 중이에요.")


async def get_admin_product_service(
    session: AsyncSession = Depends(get_session),
) -> AdminProductService:
    return AdminProductService(SqlAdminProductQueries(session))
