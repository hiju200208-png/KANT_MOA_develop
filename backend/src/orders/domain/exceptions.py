# [domain] 주문 도메인 예외
# 도메인은 HTTP를 모른다. 대신 프론트와 약속한 오류 code만 들고 있고,
# 상태 코드(409, 403 등)로 바꾸는 일은 presentation 계층이 맡는다.


class OrderDomainError(Exception):
    """주문 업무 규칙을 어겼을 때 쓰는 기본 예외."""

    code = "INVALID_ORDER"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidOrderValue(OrderDomainError):
    """주문을 만들 때 값이 잘못된 경우 (예: 총액이 음수)."""

    code = "INVALID_ORDER"


class InvalidOrderTransition(OrderDomainError):
    """지금 상태에서는 할 수 없는 동작을 요청한 경우 (예: 이미 결제된 주문을 다시 결제)."""

    code = "INVALID_ORDER"


class OrderAlreadyCancelled(OrderDomainError):
    """이미 취소된 주문을 다시 취소하려는 경우."""

    code = "ALREADY_CANCELLED"


class OrderAccessDenied(OrderDomainError):
    """다른 사람의 주문에 손대려는 경우."""

    # 프론트 오류 목록에 권한 오류 code가 없어서 팀 규칙대로 UNKNOWN + 의미 있는 메시지를 쓴다.
    code = "UNKNOWN"


# ---------- 배송지 ----------
# 프론트 오류 목록에 배송지 전용 code가 없어서 모두 UNKNOWN + 상황별 메시지를 쓴다.
# 어떤 상태 코드(422·404·403·409)로 보낼지는 presentation/errors.py가 정한다.


class InvalidAddressValue(OrderDomainError):
    """배송지 입력값이 잘못된 경우 (예: 우편번호가 5자리가 아님)."""

    code = "UNKNOWN"


class AddressNotFound(OrderDomainError):
    """없는 배송지 번호를 요청한 경우."""

    code = "UNKNOWN"


class AddressAccessDenied(OrderDomainError):
    """다른 사람의 배송지에 손대려는 경우."""

    code = "UNKNOWN"


class AddressLimitExceeded(OrderDomainError):
    """한 사람이 저장할 수 있는 배송지 개수를 넘긴 경우."""

    code = "UNKNOWN"
