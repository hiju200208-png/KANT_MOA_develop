import asyncio
from dataclasses import dataclass

import pytest

from admin.application.stock_service import AdminStockService
from admin.domain.stock_adjustment import StockAdjustment, VariantNotFound


class OutOfStock(Exception):
    """P2 decrease_stock이 올릴 재고 부족 예외 자리 (실제 이름은 P2 구현을 따른다)."""


@dataclass
class FakeVariant:
    id: int
    product_id: int
    stock: int


class FakeStockPort:
    def __init__(self, *variants):
        self.variants = {v.id: v for v in variants}
        self.locked: list[int] = []

    async def lock_variant(self, variant_id):
        self.locked.append(variant_id)
        return self.variants.get(variant_id)

    async def increase_stock(self, variant, quantity):
        variant.stock += quantity
        return variant.stock

    async def decrease_stock(self, variant, quantity):
        if variant.stock - quantity < 0:  # P2 규칙을 흉내만 낸다
            raise OutOfStock()
        variant.stock -= quantity
        return variant.stock


class FakeTransaction:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def make(*variants):
    port, tx = FakeStockPort(*variants), FakeTransaction()
    return AdminStockService(port, tx), port, tx


def test_increase_locks_then_commits_once():
    service, port, tx = make(FakeVariant(id=301, product_id=12, stock=37))
    result = asyncio.run(service.adjust(12, 301, StockAdjustment(change=10, reason="입고")))
    assert (result.variant_id, result.before, result.after, result.change) == (301, 37, 47, 10)
    assert port.locked == [301]
    assert (tx.commits, tx.rollbacks) == (1, 0)


def test_decrease_commits():
    service, _, tx = make(FakeVariant(id=301, product_id=12, stock=37))
    result = asyncio.run(service.adjust(12, 301, StockAdjustment(change=-7)))
    assert (result.before, result.after, result.change) == (37, 30, -7)
    assert tx.commits == 1


def test_decrease_below_zero_rolls_back_and_keeps_stock():
    variant = FakeVariant(id=301, product_id=12, stock=37)
    service, _, tx = make(variant)
    with pytest.raises(OutOfStock):
        asyncio.run(service.adjust(12, 301, StockAdjustment(change=-40)))
    assert variant.stock == 37
    assert (tx.commits, tx.rollbacks) == (0, 1)


def test_missing_variant_is_404_and_rolls_back():
    service, _, tx = make()
    with pytest.raises(VariantNotFound):
        asyncio.run(service.adjust(12, 999, StockAdjustment(change=1)))
    assert (tx.commits, tx.rollbacks) == (0, 1)


def test_variant_of_other_product_is_404_and_untouched():
    variant = FakeVariant(id=301, product_id=99, stock=5)
    service, _, tx = make(variant)
    with pytest.raises(VariantNotFound):
        asyncio.run(service.adjust(12, 301, StockAdjustment(change=3)))
    assert variant.stock == 5
    assert (tx.commits, tx.rollbacks) == (0, 1)
