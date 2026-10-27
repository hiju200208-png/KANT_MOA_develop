# [test] 주문서 도메인 규칙: 받는 분 검사, 배송비, 주문 가능 여부, 결제 직전 검사 (DB 없음)
from uuid import uuid4

import pytest
from order_fakes import variant

from orders.domain.cart import CartLine
from orders.domain.checkout import (
    Recipient,
    ShippingPolicy,
    calc_shipping_fee,
    draft_direct,
    draft_from_cart,
    ensure_payable,
)
from orders.domain.exceptions import CartEmpty, InvalidOrderValue, InvalidRecipient, PurchaseLimitExceeded, VariantUnavailable
from orders.domain.order import Order, OrderItem

RECIPIENT = Recipient(" 김여름 ", "010-1234-5678", " 서울 강남구 1 ")
POLICY = ShippingPolicy(free_shipping_threshold=50000, shipping_fee=3000)


# ---------- 받는 분 ----------

def test_recipient_is_trimmed():
    assert (RECIPIENT.name, RECIPIENT.address) == ("김여름", "서울 강남구 1")


@pytest.mark.parametrize("name, phone, address", [
    ("", "010-1234-5678", "서울"),
    ("김여름", "02-123-4567", "서울"),
    ("김여름", "010-1234-5678", "   "),
    ("가" * 51, "010-1234-5678", "서울"),
])
def test_invalid_recipient_is_rejected(name, phone, address):
    with pytest.raises(InvalidRecipient) as caught:
        Recipient(name, phone, address)
    # 입력 오류는 '결제할 수 없는 주문(INVALID_ORDER)' 안내가 아니라 UNKNOWN + 칸별 메시지
    assert caught.value.code == "UNKNOWN"


# ---------- 배송비 ----------

@pytest.mark.parametrize("items_price, fee", [(49999, 3000), (50000, 0), (80000, 0), (0, 3000)])
def test_shipping_fee_by_threshold(items_price, fee):
    assert calc_shipping_fee(items_price, POLICY) == fee


def test_no_shipping_settings_means_free():
    assert calc_shipping_fee(1000, None) == 0


# ---------- 장바구니 주문 ----------

def test_cart_order_snapshots_items_and_adds_shipping_fee():
    lines = [CartLine(variant(1, unit_price=15000), 2), CartLine(variant(2, unit_price=5000), 1)]
    draft = draft_from_cart(RECIPIENT, lines, {}, POLICY)
    assert [(i.variant_id, i.product_name, i.unit_price, i.quantity) for i in draft.items] == [
        (1, "상품1", 15000, 2), (2, "상품2", 5000, 1)]
    assert (draft.items_price, draft.shipping_fee, draft.total_price, draft.is_direct) == (35000, 3000, 38000, False)


def test_empty_cart_cannot_order():
    with pytest.raises(CartEmpty):
        draft_from_cart(RECIPIENT, [], {}, POLICY)


@pytest.mark.parametrize("overrides, quantity", [
    ({"product_status": "sold_out"}, 1),
    ({"product_status": "hidden"}, 1),
    ({"stock": 1}, 2),
])
def test_unavailable_line_blocks_order(overrides, quantity):
    with pytest.raises(VariantUnavailable) as caught:
        draft_from_cart(RECIPIENT, [CartLine(variant(1, **overrides), quantity)], {}, POLICY)
    assert caught.value.code == "UNAVAILABLE_ITEM"


def test_purchase_limit_counts_already_paid():
    line = CartLine(variant(1, max_per_user=3), 2)
    draft_from_cart(RECIPIENT, [line], {1: 1}, POLICY)  # 1 + 2 = 3 → 통과
    with pytest.raises(PurchaseLimitExceeded):
        draft_from_cart(RECIPIENT, [line], {1: 2}, POLICY)  # 2 + 2 = 4 → 초과


def test_unlimited_variant_has_no_purchase_limit():
    draft_from_cart(RECIPIENT, [CartLine(variant(1, max_per_user=None, stock=50), 40)], {1: 100}, POLICY)


# ---------- 바로 구매 ----------

def test_direct_order_is_marked_and_free_shipping_over_threshold():
    draft = draft_direct(RECIPIENT, variant(1, unit_price=25000), 2, 0, POLICY)
    assert (draft.is_direct, draft.total_price, draft.shipping_fee, len(draft.items)) == (True, 50000, 0, 1)


@pytest.mark.parametrize("quantity", [0, -1, 100, True])
def test_direct_order_quantity_must_be_valid(quantity):
    with pytest.raises(InvalidOrderValue) as caught:
        draft_direct(RECIPIENT, variant(1), quantity, 0, POLICY)
    assert caught.value.code == "INVALID_ORDER"


def test_direct_order_of_missing_variant_is_unavailable():
    with pytest.raises(VariantUnavailable):
        draft_direct(RECIPIENT, None, 1, 0, POLICY)


# ---------- 결제 직전 ----------

def test_payable_checks_sale_status_and_limit():
    ensure_payable(variant(1), 4, 0)
    with pytest.raises(VariantUnavailable):
        ensure_payable(variant(1, product_status="hidden"), 1, 0)
    with pytest.raises(PurchaseLimitExceeded):
        ensure_payable(variant(1, max_per_user=4), 1, 4)


# ---------- 주문 금액 ----------

def test_order_items_price_excludes_shipping_fee():
    order = Order(id=uuid4(), user_id=uuid4(), total_price=13000, shipping_fee=3000,
                  items=[OrderItem(1, "상품1", "기본", 5000, 2)])
    assert (order.items_price, order.quantities) == (10000, {1: 2})


def test_shipping_fee_cannot_exceed_total():
    with pytest.raises(InvalidOrderValue):
        Order(id=uuid4(), user_id=uuid4(), total_price=1000, shipping_fee=3000)
