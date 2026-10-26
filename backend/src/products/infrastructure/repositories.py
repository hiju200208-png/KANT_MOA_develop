from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from products.domain.variant import ProductVariant
from products.infrastructure.models import ProductVariantModel


class ProductRepository:
    """잠금·도메인 변환·flush만 담당. 서비스가 같은 세션을 commit/rollback한다."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._locked: dict[int, tuple] = {}

    async def get_variants_for_update(self, variant_ids: Iterable[int]) -> list[ProductVariant]:
        ids = list(variant_ids)
        if any(type(value) is not int or value <= 0 for value in ids):
            raise ValueError("옵션 ID는 양의 정수여야 해요.")
        ids = sorted(set(ids))
        if not ids:
            return []
        rows = await self.session.scalars(
            select(ProductVariantModel)
            .where(ProductVariantModel.id.in_(ids))
            .order_by(ProductVariantModel.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        variants = []
        for row in rows:
            variant = ProductVariant(
                id=row.id, product_id=row.product_id, stock=row.stock,
                option_name=row.option_name, extra_price=row.extra_price,
                max_per_user=row.max_per_user, sort_order=row.sort_order,
            )
            self._locked[row.id] = (variant, row, self.session.get_transaction())
            variants.append(variant)
        # 누락 ID는 반환하지 않음. 호출 서비스가 전체 ID와 비교하고 rollback한다.
        return variants

    async def save_variant(self, variant: ProductVariant) -> None:
        locked = self._locked.get(variant.id)
        if (locked is None or locked[0] is not variant
                or locked[2] is not self.session.get_transaction()):
            raise ValueError("같은 트랜잭션에서 잠금 조회한 옵션만 저장할 수 있어요.")
        # 변환 과정에서 재고 불변식을 다시 검증한다.
        ProductVariant(id=variant.id, product_id=variant.product_id, stock=variant.stock)
        locked[1].stock = variant.stock
        await self.session.flush()
