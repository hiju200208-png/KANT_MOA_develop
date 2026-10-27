from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from products.infrastructure.catalog import CatalogRepository
from products.infrastructure.models import ProductModel, WishlistModel


class WishlistRepository:
    """사용자별 찜 저장. commit/rollback은 서비스가 소유한다."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_products(self, user_id: UUID, *, page: int, size: int):
        catalog = CatalogRepository(self.session)
        query = (catalog.visible_query()
                 .join(WishlistModel, WishlistModel.product_id == ProductModel.id)
                 .where(WishlistModel.user_id == user_id))
        total = await self.session.scalar(select(func.count()).select_from(query.subquery()))
        rows = (await self.session.execute(
            query.order_by(WishlistModel.created_at.desc(), WishlistModel.product_id.desc())
            .offset((page - 1) * size).limit(size)
        )).all()
        return await catalog.to_products(rows), total

    async def ids(self, user_id: UUID) -> list[int]:
        return list(await self.session.scalars(
            select(WishlistModel.product_id)
            .join(ProductModel, ProductModel.id == WishlistModel.product_id)
            .where(WishlistModel.user_id == user_id, ProductModel.status.in_(("on_sale", "sold_out")))
            .order_by(WishlistModel.created_at.desc(), WishlistModel.product_id.desc())
        ))

    async def add(self, user_id: UUID, product_id: int) -> bool:
        # FOR SHARE는 추가끼리 동시 진행을 허용하고, commit 전 상품 삭제·hidden 전환은 막는다.
        available = await self.session.scalar(
            select(ProductModel.id)
            .where(ProductModel.id == product_id, ProductModel.status.in_(("on_sale", "sold_out")))
            .with_for_update(read=True)
        )
        if available is None:
            return False
        # 복합 PK 충돌만 멱등 처리한다. FK 등 다른 무결성 오류는 숨기지 않는다.
        await self.session.execute(insert(WishlistModel).values(user_id=user_id, product_id=product_id)
                                   .on_conflict_do_nothing(index_elements=[WishlistModel.user_id, WishlistModel.product_id]))
        return True

    async def remove(self, user_id: UUID, product_id: int) -> None:
        # hidden·삭제된 상품도 본인 찜 해제는 허용한다. 타 사용자 행은 건드리지 않는다.
        await self.session.execute(delete(WishlistModel).where(
            WishlistModel.user_id == user_id, WishlistModel.product_id == product_id,
        ))
