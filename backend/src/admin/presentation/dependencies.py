"""관리자 API 의존성.

- require_admin: P1 auth.presentation.dependencies.require_admin을 그대로 쓴다
  (토큰 없음·만료·블랙리스트 401, ADMIN 아님 403).
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
from auth.presentation.dependencies import require_admin
from database import get_session

__all__ = ["require_admin"]


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
