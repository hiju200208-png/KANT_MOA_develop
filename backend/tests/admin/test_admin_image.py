import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin.application.image_service import AdminProductImageService
from admin.domain.product_image import MAX_IMAGE_BYTES, ImageUpload, InvalidImage
from admin.domain.product_view import AdminProductDetailRow, AdminProductRow
from admin.domain.stock_adjustment import ProductNotFound
from admin.infrastructure.image_storage import LocalImageStorage
from admin.presentation.dependencies import get_admin_image_service, require_admin
from admin.presentation.router import router
from core.errors import ApiError, register_error_handlers

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 20
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 8


# --- 도메인 ---
@pytest.mark.parametrize("ctype,data,ext", [("image/png", PNG, "png"), ("image/jpeg", JPG, "jpg"),
                                            ("image/jpg", JPG, "jpg"), ("image/webp", WEBP, "webp")])
def test_allowed_images(ctype, data, ext):
    assert ImageUpload(ctype, data).extension == ext


@pytest.mark.parametrize("ctype,data", [
    ("image/gif", b"GIF89a" + b"\x00" * 10),       # 허용 안 된 형식
    ("image/png", JPG),                            # 이름표와 실제 내용 불일치
    ("text/html", b"<script>"),
    ("image/png", b""),                            # 빈 파일
    ("image/png", PNG + b"\x00" * MAX_IMAGE_BYTES),  # 5MB 초과
])
def test_rejected_images(ctype, data):
    with pytest.raises(InvalidImage):
        ImageUpload(ctype, data)


# --- 저장소 ---
def test_local_storage_saves_new_name_and_deletes_only_inside(tmp_path):
    storage = LocalImageStorage(root=tmp_path)
    path = storage.save(ImageUpload("image/png", PNG))
    assert path.startswith("/uploads/products/") and path.endswith(".png")
    file = tmp_path / "products" / path.rsplit("/", 1)[1]
    assert file.read_bytes() == PNG
    assert storage.save(ImageUpload("image/png", PNG)) != path  # 교체도 항상 새 파일명
    (tmp_path / "secret.txt").write_text("keep")
    storage.delete("/uploads/products/../secret.txt")
    assert (tmp_path / "secret.txt").exists()
    storage.delete(path)
    assert not file.exists()


# --- 서비스 ---
def row(thumb=None):
    return AdminProductRow(1, "응원봉", "bts", "BTS", "lightstick", "응원봉", 45000, "on_sale", thumb, 3, 1)


class FakeProducts:
    def __init__(self):
        self.thumb = None

    async def get_product(self, product_id):
        return AdminProductDetailRow(row(self.thumb), ()) if product_id == 1 else None


class FakeWriter:
    def __init__(self, products, fail=False):
        self.products, self.fail = products, fail

    async def update_thumbnail(self, product_id, path):
        if self.fail:
            raise RuntimeError("db down")
        self.products.thumb = path
        return True


class FakeTx:
    def __init__(self):
        self.commits = self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def make(tmp_path, fail=False):
    products = FakeProducts()
    tx = FakeTx()
    storage = LocalImageStorage(root=tmp_path)
    return AdminProductImageService(products, FakeWriter(products, fail), storage, tx), tx


def test_replace_saves_file_updates_path_and_commits(tmp_path):
    service, tx = make(tmp_path)
    detail = asyncio.run(service.replace_thumbnail(1, ImageUpload("image/png", PNG)))
    assert detail.product.thumbnail_path.startswith("/uploads/products/") and tx.commits == 1
    assert len(list((tmp_path / "products").iterdir())) == 1


def test_missing_product_saves_nothing(tmp_path):
    service, tx = make(tmp_path)
    with pytest.raises(ProductNotFound):
        asyncio.run(service.replace_thumbnail(9, ImageUpload("image/png", PNG)))
    assert tx.rollbacks == 1 and not (tmp_path / "products").exists()


def test_db_failure_removes_saved_file(tmp_path):
    service, tx = make(tmp_path, fail=True)
    with pytest.raises(RuntimeError):
        asyncio.run(service.replace_thumbnail(1, ImageUpload("image/png", PNG)))
    assert tx.rollbacks == 1 and list((tmp_path / "products").iterdir()) == []


# --- API ---
def build(tmp_path, role="ADMIN"):
    service, tx = make(tmp_path)

    async def fake_require_admin():
        if role is None:
            raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")
        if role != "ADMIN":
            raise ApiError(403, "UNKNOWN", "접근 권한이 없어요.")

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_admin] = fake_require_admin
    app.dependency_overrides[get_admin_image_service] = lambda: service
    return TestClient(app), tx


def test_put_thumbnail_returns_detail_with_upload_url(tmp_path):
    client, tx = build(tmp_path)
    res = client.put("/admin/products/1/thumbnail", content=PNG, headers={"Content-Type": "image/png"})
    assert res.status_code == 200
    assert res.json()["thumbnail_url"].startswith("/uploads/products/") and tx.commits == 1


@pytest.mark.parametrize("headers,body", [
    ({"Content-Type": "image/gif"}, b"GIF89a"),
    ({"Content-Type": "image/png"}, JPG),
    ({"Content-Type": "application/json"}, b"{}"),
    ({"Content-Type": "image/png"}, b""),
])
def test_put_invalid_image_is_422(tmp_path, headers, body):
    client, tx = build(tmp_path)
    res = client.put("/admin/products/1/thumbnail", content=body, headers=headers)
    assert res.status_code == 422 and set(res.json()) == {"code", "message"}
    assert tx.commits == 0 and not (tmp_path / "products").exists()


def test_put_too_large_is_422_before_saving(tmp_path):
    client, _ = build(tmp_path)
    res = client.put("/admin/products/1/thumbnail", content=PNG + b"\x00" * MAX_IMAGE_BYTES,
                     headers={"Content-Type": "image/png"})
    assert res.status_code == 422 and not (tmp_path / "products").exists()


def test_put_missing_product_is_404(tmp_path):
    client, _ = build(tmp_path)
    res = client.put("/admin/products/9/thumbnail", content=PNG, headers={"Content-Type": "image/png"})
    assert res.json() == {"code": "UNKNOWN", "message": "상품을 찾을 수 없어요."}


@pytest.mark.parametrize("role,status", [(None, 401), ("USER", 403)])
def test_put_non_admin_blocked(tmp_path, role, status):
    client, _ = build(tmp_path, role=role)
    res = client.put("/admin/products/1/thumbnail", content=PNG, headers={"Content-Type": "image/png"})
    assert res.status_code == status and not (tmp_path / "products").exists()
