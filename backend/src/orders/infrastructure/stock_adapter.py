# [infrastructure] P2 재고 함수 연결: 재고 SQL을 직접 쓰지 않고 P2 ProductRepository와 decrease/increase_stock만 부른다.
# 계약: docs/products/P2_STOCK_REPOSITORY.md 2장 (같은 세션, id 오름차순 한 번에 잠금, 같은 객체 save_variant)
from sqlalchemy.ext.asyncio import AsyncSession

from orders.domain.exceptions import OutOfStock, VariantNotFound
from products.domain.variant import InsufficientStock, ProductVariant
from products.infrastructure.repositories import ProductRepository


class ProductStockAdapter:
    def __init__(self, session: AsyncSession):
        # 서비스와 똑같은 세션을 써야 주문 저장과 재고 저장이 한 트랜잭션에 묶인다.
        self._repository = ProductRepository(session)
        self._locked: dict[int, ProductVariant] = {}

    async def lock(self, variant_ids: list[int]) -> None:
        """주문의 모든 옵션을 한 번에 잠근다 (P2가 id 오름차순으로 잠가 데드락을 막는다)."""
        variants = await self._repository.get_variants_for_update(variant_ids)
        self._locked = {variant.id: variant for variant in variants}
        # 규칙(P2 계약): 잠금 결과에 빠진 옵션이 있으면 업무를 멈춘다. 서비스가 rollback한다.
        if set(self._locked) != set(variant_ids):
            raise VariantNotFound("판매하지 않는 상품이 있어요.")

    def _get(self, variant_id: int) -> ProductVariant:
        variant = self._locked.get(variant_id)
        if variant is None:  # lock()을 먼저 부르지 않은 프로그래밍 실수. 고객 오류로 숨기지 않는다.
            raise RuntimeError(f"잠그지 않은 옵션이에요: {variant_id}")
        return variant

    async def decrease(self, variant_id: int, quantity: int) -> None:
        variant = self._get(variant_id)
        try:
            variant.decrease_stock(quantity)
        except InsufficientStock:
            # P2 재고 부족 → 프론트와 약속한 OUT_OF_STOCK.
            # P2 InvalidStock(수량·재고 값 자체가 잘못됨)은 DB 데이터 이상이므로 고객 오류로 바꾸지 않고 그대로 올린다.
            raise OutOfStock(f"'{variant.option_name}' 옵션이 결제하는 사이에 품절됐어요.") from None
        await self._repository.save_variant(variant)

    async def increase(self, variant_id: int, quantity: int) -> None:
        variant = self._get(variant_id)
        variant.increase_stock(quantity)
        await self._repository.save_variant(variant)
