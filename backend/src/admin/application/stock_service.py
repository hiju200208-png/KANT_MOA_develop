"""관리자 재고 조정 서비스: 잠금 조회 → 도메인 규칙 → 저장 → commit, 실패하면 rollback.

트랜잭션(commit/rollback)은 이 서비스만 소유한다 (docs/PROJECT2.md 구조·트랜잭션 계약).
잠금은 commit/rollback 때 풀리므로, 잠근 뒤에는 짧게 끝낸다.
"""

from admin.application.ports import TransactionPort, VariantStockPort
from admin.domain.stock_adjustment import (
    StockAdjustment,
    StockAdjustmentResult,
    VariantNotFound,
    ensure_variant_in_product,
)


class AdminStockService:
    def __init__(self, stock: VariantStockPort, transaction: TransactionPort):
        self._stock = stock
        self._transaction = transaction

    async def adjust(
        self, product_id: int, variant_id: int, adjustment: StockAdjustment
    ) -> StockAdjustmentResult:
        try:
            variant = await self._stock.lock_variant(variant_id)
            if variant is None:
                raise VariantNotFound()
            ensure_variant_in_product(product_id, variant.product_id)

            before = variant.stock
            if adjustment.is_increase:
                after = await self._stock.increase_stock(variant, adjustment.quantity)
            else:
                after = await self._stock.decrease_stock(variant, adjustment.quantity)

            result = StockAdjustmentResult(variant_id=variant.id, before=before, after=after)
            await self._transaction.commit()
            return result
        except BaseException:
            await self._transaction.rollback()
            raise
