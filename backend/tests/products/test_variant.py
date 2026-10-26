import pytest

from products.domain.variant import MAX_STOCK, InsufficientStock, InvalidStock, ProductVariant


def test_stock_changes_and_insufficient_stock_leave_value_intact():
    variant = ProductVariant(id=1, product_id=2, stock=3)
    assert variant.increase_stock(2) == 5
    assert variant.decrease_stock(5) == 0
    with pytest.raises(InsufficientStock):
        variant.decrease_stock(1)
    assert variant.stock == 0


@pytest.mark.parametrize("quantity", [0, -1, True, False, 1.5, "2", None])
def test_invalid_quantities_do_not_change_stock(quantity):
    variant = ProductVariant(id=1, product_id=2, stock=3)
    for operation in (variant.increase_stock, variant.decrease_stock):
        with pytest.raises(InvalidStock):
            operation(quantity)
        assert variant.stock == 3


@pytest.mark.parametrize("stock", [-1, True, 0.5, MAX_STOCK + 1])
def test_invalid_initial_stock(stock):
    with pytest.raises(InvalidStock):
        ProductVariant(id=1, product_id=2, stock=stock)


def test_integer_overflow_does_not_change_stock():
    variant = ProductVariant(id=1, product_id=2, stock=MAX_STOCK)
    with pytest.raises(InvalidStock):
        variant.increase_stock(1)
    assert variant.stock == MAX_STOCK
