# [domain] 주문 엔티티: 결제·취소 시 상태 전이 규칙을 지킨다
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from orders.domain.exceptions import (
    InvalidOrderTransition,
    InvalidOrderValue,
    OrderAccessDenied,
    OrderAlreadyCancelled,
)
from orders.domain.order_status import OrderStatus, can_transition


@dataclass(frozen=True)
class OrderItem:
    """주문 상품 한 줄. 상품명·옵션명·단가는 주문할 때 값을 복사해 둔 것이다 (스냅샷)."""

    variant_id: int
    product_name: str
    option_name: str
    unit_price: int
    quantity: int

    @property
    def line_price(self) -> int:
        return self.unit_price * self.quantity


@dataclass
class Order:
    """주문 한 건. 상태를 바꾸는 일은 반드시 pay()/cancel() 메서드로만 한다."""

    id: UUID
    user_id: UUID
    total_price: int  # 실제 결제 금액 = 상품 금액 + 배송비
    status: OrderStatus = OrderStatus.PENDING
    paid_at: datetime | None = None
    cancelled_at: datetime | None = None
    shipping_fee: int = 0
    is_direct: bool = False  # 바로 구매 주문이면 True (결제해도 장바구니를 건드리지 않음)
    recipient_name: str = ""
    recipient_phone: str = ""
    address: str = ""
    created_at: datetime | None = None
    items: list[OrderItem] = field(default_factory=list)

    @property
    def items_price(self) -> int:
        """배송비를 뺀 상품 금액."""
        return self.total_price - self.shipping_fee

    @property
    def quantities(self) -> dict[int, int]:
        """옵션별 수량 (결제 때 재고 차감, 취소 때 재고 복구에 쓴다)."""
        return {item.variant_id: item.quantity for item in self.items}

    def __post_init__(self) -> None:
        # DB에서 읽은 문자열("paid" 등)도 받을 수 있게 열거형으로 바꾼다.
        # 목록에 없는 값이면 잘못 저장된 데이터이므로 바로 막는다.
        try:
            self.status = OrderStatus(self.status)
        except ValueError:
            raise InvalidOrderValue("알 수 없는 주문 상태예요.") from None

        # 규칙: 주문 총액은 0원 이상이어야 한다.
        if self.total_price < 0:
            raise InvalidOrderValue("주문 금액은 0원 이상이어야 해요.")
        # 규칙: 배송비는 0원 이상이고 결제 금액 안에 들어 있어야 한다.
        if not 0 <= self.shipping_fee <= self.total_price:
            raise InvalidOrderValue("배송비가 올바르지 않아요.")

        # 규칙: 상태와 시각 기록이 서로 맞아야 한다.
        # 결제 완료 주문에 결제 시각이 없거나, 취소 주문에 취소 시각이 없으면 이상한 데이터다.
        if self.status is OrderStatus.PAID and self.paid_at is None:
            raise InvalidOrderValue("결제 완료 주문에는 결제 시각이 있어야 해요.")
        if self.status is OrderStatus.CANCELLED and self.cancelled_at is None:
            raise InvalidOrderValue("취소된 주문에는 취소 시각이 있어야 해요.")
        if self.status is OrderStatus.PENDING and (self.paid_at is not None or self.cancelled_at is not None):
            raise InvalidOrderValue("결제 대기 주문에는 결제·취소 시각이 없어야 해요.")

    def ensure_owned_by(self, user_id: UUID) -> None:
        """규칙: 주문은 주문한 본인만 조회·결제·취소할 수 있다."""
        if self.user_id != user_id:
            raise OrderAccessDenied("다른 사람의 주문이에요.")

    def pay(self, now: datetime) -> None:
        """결제 완료로 바꾼다. 재고 차감은 서비스가 P2 함수로 같은 트랜잭션 안에서 처리한다."""
        # 규칙: 결제는 '결제 대기' 주문만 할 수 있다 (버튼 연타로 두 번 결제되는 것 방지).
        if not can_transition(self.status, OrderStatus.PAID):
            raise InvalidOrderTransition("결제할 수 없는 주문이에요.")
        self.status = OrderStatus.PAID
        self.paid_at = now

    def cancel(self, now: datetime) -> bool:
        """주문을 취소한다. 재고를 되돌려야 하면 True를 돌려준다."""
        # 규칙: 이미 취소된 주문은 다시 취소할 수 없다. 프론트가 따로 안내하도록 전용 예외를 쓴다.
        if self.status is OrderStatus.CANCELLED:
            raise OrderAlreadyCancelled("이미 취소된 주문이에요.")
        if not can_transition(self.status, OrderStatus.CANCELLED):
            raise InvalidOrderTransition("취소할 수 없는 주문이에요.")

        # 결제 완료 주문만 재고가 빠져 있었으므로 그때만 재고 복구가 필요하다.
        # 결제 대기 주문은 재고를 건드린 적이 없어서 복구하면 오히려 재고가 늘어난다.
        needs_stock_restore = self.status is OrderStatus.PAID
        self.status = OrderStatus.CANCELLED
        self.cancelled_at = now
        return needs_stock_restore
