# [presentation] P3 도메인 예외 → HTTP 오류 응답 {code, message}
# code는 도메인 예외가 들고 있는 값을 그대로 쓰고, 상태 코드만 여기서 정한다 (공통 계약: docs/PROJECT2.md).
from core.errors import ApiError
from orders.domain.exceptions import (
    AddressAccessDenied,
    AddressLimitExceeded,
    AddressNotFound,
    InvalidAddressValue,
    InvalidOrderTransition,
    InvalidOrderValue,
    OrderAccessDenied,
    OrderAlreadyCancelled,
    OrderDomainError,
)

_STATUS_BY_ERROR: dict[type[OrderDomainError], int] = {
    InvalidAddressValue: 422,  # 입력 형식 오류
    InvalidOrderValue: 422,
    AddressNotFound: 404,  # 없는 데이터
    AddressAccessDenied: 403,  # 남의 데이터
    OrderAccessDenied: 403,
    AddressLimitExceeded: 409,  # 업무 규칙 위반
    InvalidOrderTransition: 409,
    OrderAlreadyCancelled: 409,
}


def to_api_error(error: OrderDomainError) -> ApiError:
    # 목록에 없는 새 예외가 생겨도 500이 아니라 업무 규칙 위반(409)으로 응답한다.
    status = next((code for kind, code in _STATUS_BY_ERROR.items() if isinstance(error, kind)), 409)
    return ApiError(status, error.code, error.message)
