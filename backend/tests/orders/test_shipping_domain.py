# [test] 배송은 결제 완료 주문만 순방향으로 진행하며 취소·재고와 상태를 섞지 않는다.
from datetime import datetime, timezone

import pytest

from orders.domain.exceptions import InvalidOrderTransition
from orders.domain.shipping import Shipment

NOW = datetime(2026, 10, 27, tzinfo=timezone.utc)


def test_shipping_records_dispatch_and_delivery_times():
    shipment = Shipment()
    shipment.advance("paid", "shipped", NOW)
    assert shipment.shipped_at == NOW
    assert shipment.delivered_at is None
    shipment.advance("paid", "delivered", NOW)
    assert shipment.delivered_at == NOW


@pytest.mark.parametrize("payment,current,target", [
    ("pending", "preparing", "shipped"), ("cancelled", "preparing", "shipped"),
    ("paid", "preparing", "delivered"), ("paid", "shipped", "preparing"),
    ("paid", "delivered", "shipped"), ("paid", "shipped", "shipped"),
])
def test_shipping_rejects_unpaid_cancelled_skipped_reverse_and_duplicate(payment, current, target):
    shipment = Shipment(current)
    with pytest.raises(InvalidOrderTransition):
        shipment.advance(payment, target, NOW)
    assert shipment.status == current
