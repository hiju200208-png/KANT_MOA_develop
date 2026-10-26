import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

import asyncio

import pytest

from admin.application.stock_service import AdminStockService
from admin.domain.stock_adjustment import (
    InsufficientStock,
    InvalidStockAdjustment,
    StockAdjustment,
    VariantNotFound,
)
from admin.infrastructure.variant_stock import P2VariantStockAdapter
from products.domain.variant import MAX_STOCK, ProductVariant


class FakeP2Repository:
    """P2 ProductRepository 계약 흉내: 누락 id 제외, 같은 객체만 save 가능."""

    def __init__(self, *variants):
        self.rows = {v.id: v for v in variants}
        self.locked = {}
        self.saved = []
        self.lock_calls = []

    async def get_variants_for_update(self, ids):
        ids = sorted(set(ids))
        self.lock_calls.append(ids)
        found = [ProductVariant(id=i, product_id=self.rows[i].product_id, stock=self.rows[i].stock) for i in ids if i in self.rows]
        self.locked.update({v.id: v for v in found})
        return found

    async def save_variant(self, variant):
        assert self.locked.get(variant.id) is variant, "잠금 조회한 같은 객체만 저장"
        self.saved.append((variant.id, variant.stock))


class FakeTx:
    def __init__(self):
        self.commits = self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def setup(stock=37, product_id=12):
    repo = FakeP2Repository(ProductVariant(id=301, product_id=product_id, stock=stock))
    tx = FakeTx()
    return AdminStockService(P2VariantStockAdapter(repository=repo), tx), repo, tx


def test_increase_uses_p2_lock_then_save_then_commit():
    service, repo, tx = setup()
    result = asyncio.run(service.adjust(12, 301, StockAdjustment(change=10)))
    assert (result.before, result.after) == (37, 47)
    assert repo.lock_calls == [[301]] and repo.saved == [(301, 47)]
    assert (tx.commits, tx.rollbacks) == (1, 0)


def test_decrease_below_zero_maps_p2_error_to_409_and_rolls_back():
    service, repo, tx = setup(stock=3)
    with pytest.raises(InsufficientStock):
        asyncio.run(service.adjust(12, 301, StockAdjustment(change=-5)))
    assert repo.saved == [] and (tx.commits, tx.rollbacks) == (0, 1)


def test_over_max_stock_maps_to_422():
    service, repo, tx = setup(stock=MAX_STOCK - 1)
    with pytest.raises(InvalidStockAdjustment):
        asyncio.run(service.adjust(12, 301, StockAdjustment(change=5)))
    assert repo.saved == [] and tx.rollbacks == 1


@pytest.mark.parametrize("product_id,variant_id", [(12, 999), (99, 301)])
def test_missing_or_other_product_variant_is_404(product_id, variant_id):
    service, repo, tx = setup()
    with pytest.raises(VariantNotFound):
        asyncio.run(service.adjust(product_id, variant_id, StockAdjustment(change=1)))
    assert repo.saved == [] and tx.rollbacks == 1
