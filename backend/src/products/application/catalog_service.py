from products.domain.product import ProductNotFound
from products.infrastructure.catalog import CatalogRepository


class CatalogService:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    async def list_products(self, **query):
        return await self.repository.list_products(**query)

    async def get_product(self, product_id: int):
        product = await self.repository.get_product(product_id)
        if product is None:
            raise ProductNotFound("상품을 찾을 수 없어요.")
        return product
