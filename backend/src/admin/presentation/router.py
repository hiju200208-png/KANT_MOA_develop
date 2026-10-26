"""관리자 API 라우터.

main.py 등록(app.include_router)은 P1 인증 PR이 main에 들어온 뒤 P4 PR에서 한다 (10/24 희주님 합의).
상품 목록·상세는 공용 테이블 구조(backend/sql/001_create_tables.sql) 기준 조회 전용으로 연결했다.
판매 상태 변경(PATCH)은 상태만 바꾸고 바뀐 상세를 돌려준다. 재고 때문에 상태를 자동으로 바꾸지 않는다.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from admin.application.product_service import AdminProductService, AdminProductStatusService
from admin.application.stock_service import AdminStockService
from admin.domain.product_view import AdminProductDetailRow, AdminProductRow, to_public_image_path
from admin.domain.stock_adjustment import AdminDomainError, StockAdjustment
from admin.presentation.dependencies import (
    get_admin_product_service,
    get_admin_product_status_service,
    get_admin_stock_service,
    require_admin,
)
from admin.presentation.errors import to_api_error
from admin.presentation.schemas import (
    AdminProductDetail,
    AdminProductListItem,
    AdminProductQuery,
    AdminVariantItem,
    NamedRef,
    ProductStatusUpdate,
    StockAdjustmentRequest,
    StockAdjustmentResponse,
)
from core.schemas import ErrorResponse, PageResponse

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422)}
_READ_ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 422)}


def _base_fields(row: AdminProductRow) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "artist": NamedRef(slug=row.artist_slug, name=row.artist_name),
        "category": NamedRef(slug=row.category_slug, name=row.category_name),
        "price": row.price,
        "status": row.status,
        "thumbnail_url": to_public_image_path(row.thumbnail_path),
    }


def _to_list_item(row: AdminProductRow) -> AdminProductListItem:
    return AdminProductListItem(
        **_base_fields(row),
        total_stock=row.total_stock,
        variant_count=row.variant_count,
        is_sold_out=row.is_sold_out,
    )


def _to_detail(detail: AdminProductDetailRow) -> AdminProductDetail:
    return AdminProductDetail(
        **_base_fields(detail.product),
        is_sold_out=detail.product.is_sold_out,
        variants=[
            AdminVariantItem(
                id=v.id,
                option_name=v.option_name,
                extra_price=v.extra_price,
                stock=v.stock,
                max_per_user=v.max_per_user,
            )
            for v in detail.variants
        ],
    )


@router.get(
    "/products",
    response_model=PageResponse[AdminProductListItem],
    responses=_READ_ERRORS,
    summary="관리자 상품 목록 (숨김 포함, 재고 합계·품절 계산)",
)
async def list_products(
    query: Annotated[AdminProductQuery, Query()],
    service: AdminProductService = Depends(get_admin_product_service),
) -> PageResponse[AdminProductListItem]:
    rows, total = await service.list_products(query)
    return PageResponse[AdminProductListItem](
        items=[_to_list_item(r) for r in rows], total=total, page=query.page, size=query.size
    )


@router.get(
    "/products/{product_id}",
    response_model=AdminProductDetail,
    responses=_READ_ERRORS,
    summary="관리자 상품 상세 (옵션별 재고 포함)",
)
async def get_product(
    product_id: int = Path(ge=1),
    service: AdminProductService = Depends(get_admin_product_service),
) -> AdminProductDetail:
    try:
        detail = await service.get_product(product_id)
    except AdminDomainError as error:
        raise to_api_error(error) from None
    return _to_detail(detail)


@router.patch(
    "/products/{product_id}",
    response_model=AdminProductDetail,
    responses=_READ_ERRORS,
    summary="판매 상태 변경 (on_sale / sold_out / hidden)",
)
async def change_product_status(
    body: ProductStatusUpdate,
    product_id: int = Path(ge=1),
    service: AdminProductStatusService = Depends(get_admin_product_status_service),
) -> AdminProductDetail:
    try:
        detail = await service.change_status(product_id, body.status)
    except AdminDomainError as error:
        raise to_api_error(error) from None
    return _to_detail(detail)


@router.post(
    "/products/{product_id}/variants/{variant_id}/stock-adjustments",
    response_model=StockAdjustmentResponse,
    responses=_ERRORS,
    summary="옵션 재고 조정 (증감)",
)
async def adjust_stock(
    body: StockAdjustmentRequest,
    product_id: int = Path(ge=1),
    variant_id: int = Path(ge=1),
    service: AdminStockService = Depends(get_admin_stock_service),
) -> StockAdjustmentResponse:
    try:
        adjustment = StockAdjustment(change=body.change, reason=body.reason)
        result = await service.adjust(product_id, variant_id, adjustment)
    except AdminDomainError as error:
        raise to_api_error(error) from None
    return StockAdjustmentResponse(
        variant_id=result.variant_id, before=result.before, after=result.after, change=result.change
    )
