"""관리자 API 의존성.

- require_admin: P1 auth.presentation.dependencies.require_admin을 그대로 쓴다.
  P1 인증이 main에 들어오기 전에는 모든 요청을 401로 막는 대체 함수를 쓴다(접근 허용 없음).
- get_admin_stock_service: P2 재고 규칙(ProductRepository·ProductVariant)을 연결한 서비스 (10/26 계약).
  테스트는 app.dependency_overrides로 바꿔 끼운다.
- get_admin_product_service: 요청마다 같은 AsyncSession으로 조회 전용 서비스를 만든다.
- get_admin_product_status_service: 같은 AsyncSession으로 조회·변경·commit을 묶는다.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from admin.application.image_service import AdminProductImageService
from admin.application.notice_service import AdminNoticeService
from admin.application.product_service import AdminProductService, AdminProductStatusService
from admin.application.stock_service import AdminStockService
from admin.infrastructure.image_storage import LocalImageStorage, SqlThumbnailWriter
from admin.infrastructure.notice_repository import SqlAdminNoticeRepository
from admin.infrastructure.product_queries import SqlAdminProductQueries
from admin.infrastructure.product_status import SessionTransaction, SqlProductStatusWriter
from admin.infrastructure.variant_stock import P2VariantStockAdapter
from core.errors import ApiError
from database import get_session

try:  # P1 인증 구현 후 자동으로 실제 의존성을 사용
    from auth.presentation.dependencies import require_admin  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - P1 인증 통합 전

    async def require_admin():
        raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")


async def get_admin_stock_service(session: AsyncSession = Depends(get_session)) -> AdminStockService:
    return AdminStockService(P2VariantStockAdapter(session), SessionTransaction(session))


async def get_admin_product_service(
    session: AsyncSession = Depends(get_session),
) -> AdminProductService:
    return AdminProductService(SqlAdminProductQueries(session))


async def get_admin_product_status_service(
    session: AsyncSession = Depends(get_session),
) -> AdminProductStatusService:
    return AdminProductStatusService(
        SqlAdminProductQueries(session), SqlProductStatusWriter(session), SessionTransaction(session)
    )


async def get_admin_notice_service(session: AsyncSession = Depends(get_session)) -> AdminNoticeService:
    return AdminNoticeService(SqlAdminNoticeRepository(session), SessionTransaction(session))


async def get_admin_image_service(session: AsyncSession = Depends(get_session)) -> AdminProductImageService:
    return AdminProductImageService(
        SqlAdminProductQueries(session), SqlThumbnailWriter(session), LocalImageStorage(), SessionTransaction(session)
    )
