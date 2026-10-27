# [test] 주문 상태 전이 규칙 단위 테스트 (DB 없이 순수 도메인만 검증)
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from orders.domain.exceptions import (
    InvalidOrderTransition,
    InvalidOrderValue,
    OrderAccessDenied,
    OrderAlreadyCancelled,
)
from orders.domain.order import Order
from orders.domain.order_status import ALLOWED_TRANSITIONS, OrderStatus, can_transition

# 테스트마다 시간이 달라지지 않게 시각을 고정한다.
NOW = datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc)
OWNER_ID = uuid4()


def make_order(**overrides) -> Order:
    """기본값은 '결제 대기' 주문. 필요한 값만 바꿔서 만든다."""
    values = {"id": uuid4(), "user_id": OWNER_ID, "total_price": 30000}
    values.update(overrides)
    return Order(**values)


# ---------- 허용 목록 ----------

def test_transition_table_matches_business_rules():
    assert can_transition(OrderStatus.PENDING, OrderStatus.PAID)
    assert can_transition(OrderStatus.PENDING, OrderStatus.CANCELLED)
    assert can_transition(OrderStatus.PAID, OrderStatus.CANCELLED)
    assert not can_transition(OrderStatus.PAID, OrderStatus.PENDING)
    assert not can_transition(OrderStatus.CANCELLED, OrderStatus.PAID)
    # 취소는 끝 상태: 어디로도 갈 수 없다.
    assert ALLOWED_TRANSITIONS[OrderStatus.CANCELLED] == frozenset()
    # 모든 상태가 허용 목록에 빠짐없이 들어 있어야 한다.
    assert set(ALLOWED_TRANSITIONS) == set(OrderStatus)


def test_status_values_match_frontend_strings():
    assert [s.value for s in OrderStatus] == ["pending", "paid", "cancelled"]


# ---------- 정상 흐름 ----------

def test_pay_pending_order():
    order = make_order()
    order.pay(NOW)
    assert order.status is OrderStatus.PAID
    assert order.paid_at == NOW


def test_cancel_pending_order_does_not_restore_stock():
    order = make_order()
    assert order.cancel(NOW) is False
    assert order.status is OrderStatus.CANCELLED
    assert order.cancelled_at == NOW


def test_cancel_paid_order_restores_stock():
    order = make_order()
    order.pay(NOW)
    assert order.cancel(NOW) is True
    assert order.status is OrderStatus.CANCELLED


def test_order_accepts_status_string_from_database():
    order = make_order(status="paid", paid_at=NOW)
    assert order.status is OrderStatus.PAID


def test_owner_can_access_own_order():
    make_order().ensure_owned_by(OWNER_ID)


# ---------- 규칙 위반 ----------

def test_cannot_pay_twice():
    order = make_order()
    order.pay(NOW)
    with pytest.raises(InvalidOrderTransition) as error:
        order.pay(NOW)
    assert error.value.code == "INVALID_ORDER"


def test_cannot_pay_cancelled_order():
    order = make_order()
    order.cancel(NOW)
    with pytest.raises(InvalidOrderTransition):
        order.pay(NOW)
    assert order.status is OrderStatus.CANCELLED
    assert order.paid_at is None


def test_cannot_cancel_twice():
    order = make_order()
    order.cancel(NOW)
    later = datetime(2026, 10, 27, tzinfo=timezone.utc)
    with pytest.raises(OrderAlreadyCancelled) as error:
        order.cancel(later)
    assert error.value.code == "ALREADY_CANCELLED"
    # 실패한 재취소가 처음 취소 시각을 덮어쓰면 안 된다.
    assert order.cancelled_at == NOW


# ---------- 남의 데이터 ----------

def test_other_user_cannot_access_order():
    with pytest.raises(OrderAccessDenied) as error:
        make_order().ensure_owned_by(uuid4())
    assert error.value.code == "UNKNOWN"


# ---------- 잘못된 입력 ----------

def test_negative_total_price_is_rejected():
    with pytest.raises(InvalidOrderValue):
        make_order(total_price=-1)


def test_unknown_status_is_rejected():
    with pytest.raises(InvalidOrderValue):
        make_order(status="shipping")


@pytest.mark.parametrize("overrides", [
    {"status": OrderStatus.PAID},  # 결제 완료인데 결제 시각 없음
    {"status": OrderStatus.CANCELLED},  # 취소인데 취소 시각 없음
    {"status": OrderStatus.PENDING, "paid_at": NOW},  # 결제 대기인데 결제 시각 있음
])
def test_status_and_timestamps_must_match(overrides):
    with pytest.raises(InvalidOrderValue):
        make_order(**overrides)
