"""상품 대표 이미지 교체: 상품 확인 → 파일 저장 → thumbnail_path 변경 → commit.

DB 변경이 실패하면 rollback하고 방금 저장한 파일도 지운다 (DB에 없는 파일이 남지 않게).
이전 이미지 파일은 지우지 않는다 (다른 곳에서 참조 중일 수 있음).
"""

from typing import Protocol

from admin.application.ports import TransactionPort
from admin.application.product_service import AdminProductQueryPort
from admin.domain.product_image import ImageUpload
from admin.domain.product_view import AdminProductDetailRow
from admin.domain.stock_adjustment import ProductNotFound


class ImageStoragePort(Protocol):
    def save(self, upload: ImageUpload) -> str:
        """파일을 저장하고 공개 경로(/uploads/...)를 돌려준다."""

    def delete(self, public_path: str) -> None: ...


class ThumbnailWriterPort(Protocol):
    async def update_thumbnail(self, product_id: int, public_path: str) -> bool: ...


class AdminProductImageService:
    def __init__(
        self,
        products: AdminProductQueryPort,
        writer: ThumbnailWriterPort,
        storage: ImageStoragePort,
        transaction: TransactionPort,
    ):
        self._products = products
        self._writer = writer
        self._storage = storage
        self._transaction = transaction

    async def replace_thumbnail(self, product_id: int, upload: ImageUpload) -> AdminProductDetailRow:
        saved_path: str | None = None
        try:
            if await self._products.get_product(product_id) is None:
                raise ProductNotFound()
            saved_path = self._storage.save(upload)
            if not await self._writer.update_thumbnail(product_id, saved_path):
                raise ProductNotFound()
            detail = await self._products.get_product(product_id)
            await self._transaction.commit()
            return detail
        except BaseException:
            await self._transaction.rollback()
            if saved_path:
                self._storage.delete(saved_path)
            raise
