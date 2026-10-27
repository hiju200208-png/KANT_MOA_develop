# [test] 장바구니 서비스: 담기·수량 변경·삭제·비회원 병합과 commit/rollback (가짜 저장소, DB 없음)
import asyncio
from uuid import uuid4

import pytest

from orders.application.cart_service import CartService
from orders.domain.cart import CartVariant
from orders.domain.exceptions import (
    CartItemNotFound,
    InvalidCartQuantity,
    OutOfStock,
    PurchaseLimitExceeded,
    VariantNotFound,
    VariantUnavailable,
)

ME = uuid4()
OTHER = uuid4()


def variant(variant_id, **overrides) -> CartVariant:
    values = {"variant_id": variant_id, "product_id": 10, "product_name": "응원봉", "thumbnail_path": None,
              "option_name": f"옵션{variant_id}", "unit_price": 1000, "stock": 10, "max_per_user": 4,
              "product_status": "on_sale"}
    values.update(overrides)
    return CartVariant(**values)


@pytest.fixture
def service(cart_repo, cart_tx):
    cart_repo.variants = {1: variant(1), 2: variant(2, stock=2), 3: variant(3, product_status="sold_out"),
                          4: variant(4, product_status="hidden"), 5: variant(5, max_per_user=None, stock=50)}
    return CartService(cart_repo, cart_tx), cart_tx


def run(coro):
    return asyncio.run(coro)


# ---------- 담기 ----------

def test_add_new_item_returns_cart_and_commits(service, cart_repo):
    svc, tx = service
    cart = run(svc.add(ME, 1, 2))
    assert [(line.variant.variant_id, line.quantity) for line in cart.lines] == [(1, 2)]
    assert cart.total_quantity == 2 and cart.total_price == 2000
    assert tx.commits == 1 and cart_repo.locked_users == [ME]


def test_add_same_item_adds_quantity(service, cart_repo):
    svc, _ = service
    run(svc.add(ME, 1, 1))
    cart = run(svc.add(ME, 1, 2))
    assert cart.lines[0].quantity == 3


def test_add_over_stock_is_rejected_and_rolled_back(service, cart_repo):
    svc, tx = service
    with pytest.raises(OutOfStock):
        run(svc.add(ME, 2, 3))
    assert tx.rollbacks == 1 and cart_repo.saved == {}


def test_add_checks_sum_with_already_in_cart(service, cart_repo):
    svc, _ = service
    run(svc.add(ME, 1, 3))
    with pytest.raises(PurchaseLimitExceeded):  # 장바구니 3 + 2 = 5 > 제한 4
        run(svc.add(ME, 1, 2))
    assert cart_repo.saved[(ME, 1)] == 3


def test_add_counts_already_paid_quantity(service, cart_repo):
    svc, _ = service
    cart_repo.paid[(ME, 1)] = 3
    with pytest.raises(PurchaseLimitExceeded):
        run(svc.add(ME, 1, 2))
    cart_repo.paid[(OTHER, 1)] = 4  # 남이 산 수량은 내 제한과 무관
    run(svc.add(ME, 1, 1))


@pytest.mark.parametrize("variant_id, error", [(3, VariantUnavailable), (4, VariantNotFound), (999, VariantNotFound)],
                         ids=["sold-out", "hidden", "missing"])
def test_add_unavailable_variant(service, variant_id, error):
    svc, _ = service
    with pytest.raises(error):
        run(svc.add(ME, variant_id, 1))


@pytest.mark.parametrize("quantity", [0, -1, 100])
def test_add_bad_quantity(service, quantity):
    svc, tx = service
    with pytest.raises(InvalidCartQuantity):
        run(svc.add(ME, 1, quantity))
    assert tx.commits == 0


# ---------- 수량 변경 ----------

def test_change_quantity_overwrites(service, cart_repo):
    svc, _ = service
    run(svc.add(ME, 1, 3))
    cart = run(svc.change_quantity(ME, 1, 1))
    assert cart.lines[0].quantity == 1


def test_change_quantity_of_item_not_in_cart(service):
    svc, tx = service
    with pytest.raises(CartItemNotFound):
        run(svc.change_quantity(ME, 1, 1))
    assert tx.rollbacks == 1


def test_change_quantity_over_stock(service, cart_repo):
    svc, _ = service
    run(svc.add(ME, 2, 1))
    with pytest.raises(OutOfStock):
        run(svc.change_quantity(ME, 2, 5))
    assert cart_repo.saved[(ME, 2)] == 1


# ---------- 삭제 ----------

def test_remove_item(service, cart_repo):
    svc, _ = service
    run(svc.add(ME, 1, 1))
    run(svc.add(ME, 5, 1))
    cart = run(svc.remove(ME, 1))
    assert [line.variant.variant_id for line in cart.lines] == [5]


def test_remove_missing_item(service):
    svc, _ = service
    with pytest.raises(CartItemNotFound):
        run(svc.remove(ME, 1))


def test_other_users_cart_is_separate(service, cart_repo):
    svc, _ = service
    run(svc.add(OTHER, 1, 2))
    assert run(svc.get_cart(ME)).lines == []
    with pytest.raises(CartItemNotFound):  # 남의 장바구니 항목은 내 것이 아니라 없음과 같다
        run(svc.remove(ME, 1))


# ---------- 조회 ----------

def test_get_cart_hides_hidden_product(service, cart_repo):
    svc, _ = service
    cart_repo.saved = {(ME, 1): 1, (ME, 4): 2}  # 담은 뒤 상품이 숨김 처리된 상황
    cart = run(svc.get_cart(ME))
    assert [line.variant.variant_id for line in cart.lines] == [1]


# ---------- 비회원 병합 ----------

def test_merge_adds_with_cap_and_skips_unavailable(service, cart_repo):
    svc, tx = service
    cart_repo.saved = {(ME, 1): 2}
    cart = run(svc.merge_guest(ME, [(1, 5), (2, 9), (3, 1), (4, 1), (999, 1), (5, 2), (5, 1)]))
    quantities = {line.variant.variant_id: line.quantity for line in cart.lines}
    # 1: 2+5 → 제한 4, 2: 9 → 재고 2, 3·4·999: 건너뜀, 5: 2+1 = 3 (무제한·재고 50)
    assert quantities == {1: 4, 2: 2, 5: 3}
    assert tx.commits == 1


def test_merge_empty_list_is_ok(service):
    svc, tx = service
    assert run(svc.merge_guest(ME, [])).lines == []
    assert tx.commits == 1
