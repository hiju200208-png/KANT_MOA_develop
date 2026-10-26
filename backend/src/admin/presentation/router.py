"""관리자 API 라우터.

main.py 등록(app.include_router)은 P1 인증 PR이 main에 들어온 뒤 P4 PR에서 한다 (10/24 희주님 합의).
상품 목록·상세·판매 상태 변경은 P2 상품 모델 확정 후 추가한다.
"""

from fastapi import APIRouter, Depends, Path

from admin.application.stock_service import AdminStockService
from admin.domain.stock_adjustment import AdminDomainError, StockAdjustment
from admin.presentation.dependencies import get_admin_stock_service, require_admin
from admin.presentation.errors import to_api_error
from admin.presentation.schemas import StockAdjustmentRequest, StockAdjustmentResponse
from core.schemas import ErrorResponse

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422)}


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
