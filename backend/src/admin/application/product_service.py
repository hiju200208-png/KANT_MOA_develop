"""관리자 상품 조회 서비스 (조회 전용, commit 없음).

숨김 상품까지 보는 관리자 조회는 P4 저장소에 조회 전용으로 둔다 (10/26 상재님 PR #1 답변).
"""

from typing import Protocol

from admin.application.ports import TransactionPort
from admin.domain.product_view import AdminProductDetailRow, AdminProductRow, ensure_product_status
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


class ProductStatusPort(Protocol):
    async def update_status(self, product_id: int, status: str) -> bool:
        """상품 status를 바꾸고(flush까지) 바뀐 행이 있으면 True. commit하지 않는다."""


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


class AdminProductStatusService:
    """판매 상태 변경: 검증 → 변경 → 바뀐 상세 조회 → commit. 실패하면 rollback."""

    def __init__(
        self,
        products: AdminProductQueryPort,
        writer: ProductStatusPort,
        transaction: TransactionPort,
    ):
        self._products = products
        self._writer = writer
        self._transaction = transaction

    async def change_status(self, product_id: int, status: str) -> AdminProductDetailRow:
        try:
            ensure_product_status(status)
            if not await self._writer.update_status(product_id, status):
                raise ProductNotFound()
            detail = await self._products.get_product(product_id)
            if detail is None:
                raise ProductNotFound()
            await self._transaction.commit()
            return detail
        except BaseException:
            await self._transaction.rollback()
            raise
