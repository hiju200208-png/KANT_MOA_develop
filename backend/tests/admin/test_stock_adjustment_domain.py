import pytest

from admin.domain.stock_adjustment import (
    MAX_CHANGE,
    MAX_REASON_LENGTH,
    MIN_CHANGE,
    InvalidStockAdjustment,
    StockAdjustment,
    StockAdjustmentResult,
    VariantNotFound,
    ensure_variant_in_product,
)


def test_increase_and_decrease_are_allowed():
    up = StockAdjustment(change=10, reason="입고")
    down = StockAdjustment(change=-3, reason="불량")
    assert up.is_increase and up.quantity == 10
    assert not down.is_increase and down.quantity == 3


@pytest.mark.parametrize("change", [0, MIN_CHANGE - 1, MAX_CHANGE + 1])
def test_zero_or_out_of_range_change_is_rejected(change):
    with pytest.raises(InvalidStockAdjustment):
        StockAdjustment(change=change)


@pytest.mark.parametrize("change", [True, 1.5, "10", None])
def test_change_must_be_a_real_int(change):
    with pytest.raises(InvalidStockAdjustment):
        StockAdjustment(change=change)


def test_range_boundaries_are_inclusive():
    assert StockAdjustment(change=MIN_CHANGE).change == MIN_CHANGE
    assert StockAdjustment(change=MAX_CHANGE).change == MAX_CHANGE


def test_reason_is_trimmed_and_empty_becomes_none():
    assert StockAdjustment(change=1, reason="  입고  ").reason == "입고"
    assert StockAdjustment(change=1, reason="   ").reason is None
    assert StockAdjustment(change=1).reason is None


def test_reason_length_limit():
    assert StockAdjustment(change=1, reason="가" * MAX_REASON_LENGTH)
    with pytest.raises(InvalidStockAdjustment):
        StockAdjustment(change=1, reason="가" * (MAX_REASON_LENGTH + 1))


def test_result_reports_change_and_rejects_negative_stock():
    result = StockAdjustmentResult(variant_id=301, before=37, after=47)
    assert result.change == 10
    with pytest.raises(InvalidStockAdjustment):
        StockAdjustmentResult(variant_id=301, before=37, after=-3)


def test_variant_must_belong_to_product():
    ensure_variant_in_product(product_id=12, variant_product_id=12)
    with pytest.raises(VariantNotFound):
        ensure_variant_in_product(product_id=12, variant_product_id=99)
    with pytest.raises(VariantNotFound):
        ensure_variant_in_product(product_id=12, variant_product_id=None)


def test_domain_has_no_framework_imports():
    import admin.domain.stock_adjustment as module
    from pathlib import Path

    source = Path(module.__file__).read_text(encoding="utf-8")
    for banned in ("fastapi", "sqlalchemy", "pydantic"):
        assert f"import {banned}" not in source and f"from {banned}" not in source
