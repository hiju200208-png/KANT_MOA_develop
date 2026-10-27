# [test] 장바구니 규칙 단위 테스트 (DB 없이 순수 도메인만 검증)
import pytest

from orders.domain.cart import (
    MAX_MERGE_ITEMS,
    MAX_QUANTITY,
    CartLine,
    CartVariant,
    build_cart,
    combine_guest_items,
    ensure_can_hold,
    ensure_visible,
    merge_cap,
    merged_quantity,
    validate_quantity,
)
from orders.domain.exceptions import (
    InvalidCartQuantity,
    OutOfStock,
    PurchaseLimitExceeded,
    VariantNotFound,
    VariantUnavailable,
)


def variant(**overrides) -> CartVariant:
    values = {"variant_id": 1, "product_id": 10, "product_name": "응원봉", "thumbnail_path": None,
              "option_name": "기본", "unit_price": 35000, "stock": 10, "max_per_user": 4, "product_status": "on_sale"}
    values.update(overrides)
    return CartVariant(**values)


# ---------- 수량 ----------

@pytest.mark.parametrize("quantity", [1, MAX_QUANTITY])
def test_valid_quantity(quantity):
    validate_quantity(quantity)


@pytest.mark.parametrize("quantity", [0, -1, MAX_QUANTITY + 1, True, 1.5])
def test_bad_quantity_is_rejected(quantity):
    with pytest.raises(InvalidCartQuantity):
        validate_quantity(quantity)


# ---------- 담을 수 있는지 ----------

def test_can_hold_within_stock_and_limit():
    ensure_can_hold(variant(), quantity=3, already_paid=1)


def test_missing_or_hidden_variant_is_not_found():
    with pytest.raises(VariantNotFound) as error:
        ensure_visible(None)
    assert error.value.code == "UNAVAILABLE_ITEM"
    with pytest.raises(VariantNotFound):
        ensure_visible(variant(product_status="hidden"))


def test_sold_out_product_is_unavailable():
    with pytest.raises(VariantUnavailable) as error:
        ensure_can_hold(variant(product_status="sold_out"), 1, 0)
    assert error.value.code == "UNAVAILABLE_ITEM"


def test_more_than_stock_is_out_of_stock():
    with pytest.raises(OutOfStock) as error:
        ensure_can_hold(variant(stock=2), 3, 0)
    assert error.value.code == "OUT_OF_STOCK"


def test_purchase_limit_counts_already_paid_quantity():
    ensure_can_hold(variant(max_per_user=4), 2, already_paid=2)  # 정확히 4개는 가능
    with pytest.raises(PurchaseLimitExceeded) as error:
        ensure_can_hold(variant(max_per_user=4), 3, already_paid=2)
    assert error.value.code == "PURCHASE_LIMIT_EXCEEDED"


def test_unlimited_variant_has_no_purchase_limit():
    ensure_can_hold(variant(max_per_user=None, stock=50), 50, already_paid=100)


# ---------- 화면용 합계 ----------

def test_cart_hides_hidden_and_sums_only_available_lines():
    lines = [
        CartLine(variant(variant_id=1, unit_price=1000), 2),  # 담을 수 있음
        CartLine(variant(variant_id=2, unit_price=500, stock=1), 3),  # 재고 부족 → 합계 제외
        CartLine(variant(variant_id=3, product_status="sold_out"), 1),  # 품절 → 합계 제외
        CartLine(variant(variant_id=4, product_status="hidden"), 5),  # 숨김 → 목록 제외
    ]
    cart = build_cart(lines)
    assert [line.variant.variant_id for line in cart.lines] == [1, 2, 3]
    assert [line.is_available for line in cart.lines] == [True, False, False]
    assert cart.total_quantity == 6
    assert cart.total_price == 2000


# ---------- 비회원 병합 ----------

def test_merge_cap_is_min_of_stock_and_limit():
    assert merge_cap(variant(stock=10, max_per_user=4)) == 4
    assert merge_cap(variant(stock=2, max_per_user=4)) == 2
    assert merge_cap(variant(stock=500, max_per_user=None)) == MAX_QUANTITY


@pytest.mark.parametrize("v", [None, variant(product_status="sold_out"), variant(product_status="hidden"),
                               variant(stock=0)], ids=["missing", "sold-out", "hidden", "no-stock"])
def test_merge_skips_unavailable(v):
    assert merge_cap(v) == 0


def test_merged_quantity_adds_but_respects_cap():
    assert merged_quantity(existing=1, incoming=2, cap=4) == 3
    assert merged_quantity(existing=3, incoming=3, cap=4) == 4


def test_guest_items_are_combined_and_non_positive_dropped():
    assert combine_guest_items([(1, 2), (2, 1), (1, 3), (3, 0), (4, -1)]) == {1: 5, 2: 1}


def test_too_many_guest_items_rejected():
    with pytest.raises(InvalidCartQuantity):
        combine_guest_items([(i, 1) for i in range(MAX_MERGE_ITEMS + 1)])
