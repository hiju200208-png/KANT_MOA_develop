"""P2 재고 규칙 연결부 (VariantStockPort 구현). 10/26 상재님 계약:

- 잠금 조회: P2 ProductRepository(session).get_variants_for_update(ids) — id 오름차순, FOR UPDATE, 누락 id는 제외
- 재고 증감: 반환된 P2 ProductVariant의 increase_stock / decrease_stock (0 미만·범위 규칙은 P2 도메인)
- 저장: 같은 Repository 인스턴스의 save_variant(객체) → flush (commit 없음)
- commit/rollback: P4 AdminStockService가 같은 session에서 처리
- 예외 변환: P2 InsufficientStock → P4 InsufficientStock(409), P2 InvalidStock → P4 InvalidStockAdjustment(422)
"""

from sqlalchemy.ext.asyncio import AsyncSession

from admin.domain.stock_adjustment import InsufficientStock, InvalidStockAdjustment
from products.domain.variant import InsufficientStock as P2InsufficientStock
from products.domain.variant import InvalidStock as P2InvalidStock
from products.domain.variant import ProductVariant
from products.infrastructure.repositories import ProductRepository


class P2VariantStockAdapter:
    def __init__(self, session: AsyncSession | None = None, repository: ProductRepository | None = None):
        # 잠금 조회와 저장은 반드시 같은 Repository 인스턴스로 해야 한다 (P2 save_variant 검증)
        self._repository = repository or ProductRepository(session)

    async def lock_variant(self, variant_id: int) -> ProductVariant | None:
        variants = await self._repository.get_variants_for_update([variant_id])
        # 누락이면 None → 서비스가 VariantNotFound(404)로 바꾸고 rollback
        return next((v for v in variants if v.id == variant_id), None)

    async def increase_stock(self, variant: ProductVariant, quantity: int) -> int:
        try:
            after = variant.increase_stock(quantity)
        except P2InvalidStock:
            raise InvalidStockAdjustment() from None
        await self._repository.save_variant(variant)
        return after

    async def decrease_stock(self, variant: ProductVariant, quantity: int) -> int:
        try:
            after = variant.decrease_stock(quantity)
        except P2InsufficientStock:
            raise InsufficientStock() from None
        except P2InvalidStock:
            raise InvalidStockAdjustment() from None
        await self._repository.save_variant(variant)
        return after
