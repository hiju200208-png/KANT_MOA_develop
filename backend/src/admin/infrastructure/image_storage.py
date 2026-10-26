"""업로드 이미지 로컬 저장 (backend/uploads/products/). main.py가 /uploads로 공개한다."""

from pathlib import Path
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from admin.domain.product_image import ImageUpload
from core.config import BACKEND_ROOT

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
    """products.thumbnail_path만 바꾼다 (commit 없음)."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def update_thumbnail(self, product_id: int, public_path: str) -> bool:
        result = await self._session.execute(
            text("UPDATE products SET thumbnail_path = :path WHERE id = :id RETURNING id"),
            {"path": public_path, "id": product_id},
        )
        return result.scalar_one_or_none() is not None
