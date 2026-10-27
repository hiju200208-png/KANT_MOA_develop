# [domain] 주문 상태와 상태 전이 허용 목록
from enum import StrEnum


class OrderStatus(StrEnum):
    """주문 상태. 값은 프론트(types/app.ts)와 이전 DB의 문자열과 똑같이 맞춘다."""

    PENDING = "pending"  # 결제 대기: 주문서는 만들었지만 아직 돈을 내지 않음
    PAID = "paid"  # 결제 완료: 재고가 이미 빠져나간 상태
    CANCELLED = "cancelled"  # 취소: 더 이상 아무 상태로도 바뀌지 않는 끝 상태


# 규칙: 주문 상태는 아래 화살표 방향으로만 바뀔 수 있다.
#   결제 대기 → 결제 완료, 결제 대기 → 취소, 결제 완료 → 취소
# 목록에 없는 이동(예: 취소 → 결제 완료)은 모두 금지다.
ALLOWED_TRANSITIONS: dict[OrderStatus, frozenset[OrderStatus]] = {
    OrderStatus.PENDING: frozenset({OrderStatus.PAID, OrderStatus.CANCELLED}),
    OrderStatus.PAID: frozenset({OrderStatus.CANCELLED}),
    OrderStatus.CANCELLED: frozenset(),
}


def can_transition(current: OrderStatus, target: OrderStatus) -> bool:
    """current 상태에서 target 상태로 바꿔도 되는지 허용 목록에서 확인한다."""
    return target in ALLOWED_TRANSITIONS[current]
