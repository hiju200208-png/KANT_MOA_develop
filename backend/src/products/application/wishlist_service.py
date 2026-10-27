from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from products.domain.product import ProductNotFound
from products.infrastructure.wishlist import WishlistRepository


class WishlistService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = WishlistRepository(session)

    async def list_products(self, user_id: UUID, *, page: int, size: int):
        return await self.repository.list_products(user_id, page=page, size=size)

    async def ids(self, user_id: UUID) -> list[int]:
        return await self.repository.ids(user_id)

    async def set_wished(self, user_id: UUID, product_id: int, *, wished: bool) -> None:
        try:
            if wished:
                if not await self.repository.add(user_id, product_id):
                    raise ProductNotFound("상품을 찾을 수 없어요.")
            else:
                await self.repository.remove(user_id, product_id)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
