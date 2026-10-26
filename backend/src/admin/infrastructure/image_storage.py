"""업로드 이미지 로컬 저장 (backend/uploads/products/). main.py가 /uploads로 공개한다."""

from pathlib import Path
from uuid import uuid4

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from admin.domain.product_image import ImageUpload
from core.config import BACKEND_ROOT
from products.infrastructure.models import ProductModel

UPLOAD_ROOT = BACKEND_ROOT / "uploads"
PUBLIC_PREFIX = "/uploads"


class LocalImageStorage:
    def __init__(self, root: Path = UPLOAD_ROOT, folder: str = "products"):
        self._root = root
        self._folder = folder

    def save(self, upload: ImageUpload) -> str:
        directory = self._root / self._folder
        directory.mkdir(parents=True, exist_ok=True)
        name = f"{uuid4().hex}.{upload.extension}"
        (directory / name).write_bytes(upload.data)
        return f"{PUBLIC_PREFIX}/{self._folder}/{name}"

    def delete(self, public_path: str) -> None:
        prefix = f"{PUBLIC_PREFIX}/{self._folder}/"
        if not public_path.startswith(prefix):
            return
        name = public_path[len(prefix):]
        if "/" in name or "\\" in name or name.startswith("."):
            return  # 경로 이동 방지: 이 폴더 안 파일만 지운다
        (self._root / self._folder / name).unlink(missing_ok=True)


class SqlThumbnailWriter:
    """products.thumbnail_path만 바꾼다 (P2 ORM 모델 사용, commit 없음)."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def update_thumbnail(self, product_id: int, public_path: str) -> bool:
        result = await self._session.execute(
            update(ProductModel)
            .where(ProductModel.id == product_id)
            .values(thumbnail_path=public_path)
            .returning(ProductModel.id)
            .execution_options(synchronize_session=False)
        )
        return result.scalar_one_or_none() is not None
