"""관리자 API 라우터.

main.py 등록(app.include_router)은 P1 인증 PR이 main에 들어온 뒤 P4 PR에서 한다 (10/24 희주님 합의).
상품 목록·상세는 공용 테이블 구조(backend/sql/001_create_tables.sql) 기준 조회 전용으로 연결했다.
판매 상태 변경(PATCH)은 상태만 바꾸고 바뀐 상세를 돌려준다. 재고 때문에 상태를 자동으로 바꾸지 않는다.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request, Response

from admin.application.image_service import AdminProductImageService
from admin.application.notice_service import AdminNoticeService
from admin.application.product_service import AdminProductService, AdminProductStatusService
from admin.application.stock_service import AdminStockService
from admin.domain.notice import AdminNoticeRow, NoticeChanges, NoticeDraft
from admin.domain.product_image import MAX_IMAGE_BYTES, ImageUpload, InvalidImage
from admin.domain.product_view import AdminProductDetailRow, AdminProductRow, to_public_image_path
from admin.domain.stock_adjustment import AdminDomainError, StockAdjustment
from admin.presentation.dependencies import (
    get_admin_image_service,
    get_admin_notice_service,
    get_admin_product_service,
    get_admin_product_status_service,
    get_admin_stock_service,
    require_admin,
)
from admin.presentation.errors import to_api_error
from admin.presentation.schemas import (
    AdminNoticeItem,
    AdminNoticeQuery,
    AdminProductDetail,
    AdminProductListItem,
    AdminProductQuery,
    AdminVariantItem,
    NamedRef,
    NoticeCreate,
    NoticeUpdate,
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


# --- 공지 관리 (선택 기능 #40). 사용자 화면 공지 조회는 P2 담당 ---


def _to_notice(row: AdminNoticeRow) -> AdminNoticeItem:
    return AdminNoticeItem(
        id=row.id,
        title=row.title,
        body=row.body,
        artist=NamedRef(slug=row.artist_slug, name=row.artist_name) if row.artist_slug else None,
        product_id=row.product_id,
        product_name=row.product_name,
        is_pinned=row.is_pinned,
        show_in_topbar=row.show_in_topbar,
        published_at=row.published_at,
    )


@router.get("/notices", response_model=PageResponse[AdminNoticeItem], responses=_READ_ERRORS, summary="공지 목록")
async def list_notices(
    query: Annotated[AdminNoticeQuery, Query()],
    service: AdminNoticeService = Depends(get_admin_notice_service),
) -> PageResponse[AdminNoticeItem]:
    rows, total = await service.list_notices(query.artist, query.page, query.size)
    return PageResponse[AdminNoticeItem](
        items=[_to_notice(r) for r in rows], total=total, page=query.page, size=query.size
    )


@router.get("/notices/{notice_id}", response_model=AdminNoticeItem, responses=_READ_ERRORS, summary="공지 상세")
async def get_notice(
    notice_id: int = Path(ge=1),
    service: AdminNoticeService = Depends(get_admin_notice_service),
) -> AdminNoticeItem:
    try:
        return _to_notice(await service.get_notice(notice_id))
    except AdminDomainError as error:
        raise to_api_error(error) from None


@router.post(
    "/notices", response_model=AdminNoticeItem, status_code=201, responses=_READ_ERRORS, summary="공지 등록"
)
async def create_notice(
    body: NoticeCreate,
    service: AdminNoticeService = Depends(get_admin_notice_service),
) -> AdminNoticeItem:
    try:
        return _to_notice(await service.create(NoticeDraft(**body.model_dump())))
    except AdminDomainError as error:
        raise to_api_error(error) from None


@router.patch("/notices/{notice_id}", response_model=AdminNoticeItem, responses=_READ_ERRORS, summary="공지 수정")
async def update_notice(
    body: NoticeUpdate,
    notice_id: int = Path(ge=1),
    service: AdminNoticeService = Depends(get_admin_notice_service),
) -> AdminNoticeItem:
    try:
        changes = NoticeChanges(body.model_dump(exclude_unset=True))
        return _to_notice(await service.update(notice_id, changes))
    except AdminDomainError as error:
        raise to_api_error(error) from None


@router.delete("/notices/{notice_id}", status_code=204, responses=_READ_ERRORS, summary="공지 삭제")
async def delete_notice(
    notice_id: int = Path(ge=1),
    service: AdminNoticeService = Depends(get_admin_notice_service),
) -> Response:
    try:
        await service.delete(notice_id)
    except AdminDomainError as error:
        raise to_api_error(error) from None
    return Response(status_code=204)


# --- 상품 대표 이미지 업로드 (선택 기능 #39). multipart 대신 이미지 파일을 요청 본문 그대로 받는다 ---


async def _read_limited(request: Request, limit: int) -> bytes:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise InvalidImage()
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise InvalidImage()
        chunks.append(chunk)
    return b"".join(chunks)


@router.put(
    "/products/{product_id}/thumbnail",
    response_model=AdminProductDetail,
    responses=_READ_ERRORS,
    summary="상품 대표 이미지 교체 (JPG·PNG·WebP, 5MB 이하, 본문에 이미지 파일)",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {t: {"schema": {"type": "string", "format": "binary"}} for t in ("image/jpeg", "image/png", "image/webp")},
        }
    },
)
async def replace_thumbnail(
    request: Request,
    product_id: int = Path(ge=1),
    service: AdminProductImageService = Depends(get_admin_image_service),
) -> AdminProductDetail:
    try:
        data = await _read_limited(request, MAX_IMAGE_BYTES)
        upload = ImageUpload(content_type=request.headers.get("content-type", ""), data=data)
        detail = await service.replace_thumbnail(product_id, upload)
    except AdminDomainError as error:
        raise to_api_error(error) from None
    return _to_detail(detail)
