"""관리자 도메인 예외 → HTTP 오류 응답 {code, message}.

공통 계약(docs/PROJECT2.md): 기존 오류 code에 없는 경우 UNKNOWN + 상황별 메시지,
HTTP 상태로 422·404·409를 구분한다. 신규 code는 팀 합의 후 추가.
"""

from admin.domain.notice import InvalidNotice, NoticeNotFound
from admin.domain.product_view import InvalidProductStatus
from admin.domain.stock_adjustment import (
    AdminDomainError,
    InsufficientStock,
    InvalidStockAdjustment,
    ProductNotFound,
    VariantNotFound,
)
from core.errors import ApiError

_STATUS_BY_ERROR: dict[type[AdminDomainError], int] = {
    InvalidStockAdjustment: 422,
    InvalidProductStatus: 422,
    InvalidNotice: 422,
    NoticeNotFound: 404,
    ProductNotFound: 404,
    VariantNotFound: 404,
    InsufficientStock: 409,
}


def to_api_error(error: AdminDomainError) -> ApiError:
    status = next(
        (code for kind, code in _STATUS_BY_ERROR.items() if isinstance(error, kind)), 400
    )
    return ApiError(status, "UNKNOWN", error.message)
