# [domain] 배송 상태는 결제 상태와 별개로 관리한다.
from dataclasses import dataclass
from datetime import datetime

from orders.domain.exceptions import InvalidOrderTransition


@dataclass
class Shipment:
    status: str = "preparing"
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None

    def advance(self, order_status: str, target: str, now: datetime) -> None:
        # 규칙: 결제 완료 주문만, 단계를 건너뛰거나 되돌리지 않고 배송한다.
        next_status = {"preparing": "shipped", "shipped": "delivered"}
        if order_status != "paid" or next_status.get(self.status) != target:
            raise InvalidOrderTransition("결제 완료 주문을 배송 순서대로 처리해 주세요.")
        self.status = target
        if target == "shipped":
            self.shipped_at = now
        else:
            self.delivered_at = now


def ensure_cancellable(dispatched: bool) -> None:
    # 규칙: 이미 발송한 주문은 일반 취소로 재고를 복구할 수 없다. 반품은 별도 업무다.
    if dispatched:
        raise InvalidOrderTransition("발송한 주문은 취소할 수 없어요.")
