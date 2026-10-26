"""관리자 상품 조회 서비스 (조회 전용, commit 없음).

숨김 상품까지 보는 관리자 조회는 P4 저장소에 조회 전용으로 둔다 (10/26 상재님 PR #1 답변).
"""

from typing import Protocol

from admin.domain.product_view import AdminProductDetailRow, AdminProductRow
from admin.domain.stock_adjustment import ProductNotFound


class AdminProductFilters(Protocol):
    q: str | None
    artist: str | None
    category: str | None
    status: str | None
    stock: str | None
    sort: str
    page: int
    size: int


class AdminProductQueryPort(Protocol):
    async def list_products(self, filters: AdminProductFilters) -> tuple[list[AdminProductRow], int]: ...

    async def get_product(self, product_id: int) -> AdminProductDetailRow | None: ...


class AdminProductService:
    def __init__(self, products: AdminProductQueryPort):
        self._products = products

    async def list_products(self, filters: AdminProductFilters) -> tuple[list[AdminProductRow], int]:
        return await self._products.list_products(filters)

    async def get_product(self, product_id: int) -> AdminProductDetailRow:
        detail = await self._products.get_product(product_id)
        if detail is None:
            raise ProductNotFound()
        return detail
