import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin.application.notice_service import AdminNoticeService
from admin.domain.notice import AdminNoticeRow, InvalidNotice, NoticeChanges, NoticeDraft, NoticeNotFound
from admin.presentation.dependencies import get_admin_notice_service, require_admin
from admin.presentation.router import router
from core.errors import ApiError, register_error_handlers

NOW = datetime(2026, 10, 26, 3, 0, tzinfo=timezone.utc)
ARTISTS = {"bts": (1, "BTS")}
PRODUCTS = {7: "응원봉"}


class FakeRepo:
    def __init__(self):
        self.saved: dict[int, dict] = {1: self._base(1, "기존 공지")}
        self.pending: dict[int, dict] | None = None
        self.next_id = 2

    @staticmethod
    def _base(i, title):
        return {"id": i, "title": title, "body": None, "artist_id": None, "product_id": None,
                "is_pinned": False, "show_in_topbar": False, "published_at": NOW}

    @property
    def data(self):
        if self.pending is None:
            self.pending = {k: dict(v) for k, v in self.saved.items()}
        return self.pending

    def _row(self, d):
        artist = next(((s, n) for s, (i, n) in ARTISTS.items() if i == d["artist_id"]), (None, None))
        return AdminNoticeRow(d["id"], d["title"], d["body"], artist[0], artist[1], d["product_id"],
                              PRODUCTS.get(d["product_id"]), d["is_pinned"], d["show_in_topbar"], d["published_at"])

    async def list_notices(self, artist, page, size):
        rows = [self._row(d) for d in self.data.values()]
        return rows, len(rows)

    async def get_notice(self, notice_id):
        d = self.data.get(notice_id)
        return self._row(d) if d else None

    async def find_artist_id(self, slug):
        return ARTISTS.get(slug, (None,))[0]

    async def product_exists(self, product_id):
        return product_id in PRODUCTS

    async def insert_notice(self, values):
        i = self.next_id
        self.next_id += 1
        self.data[i] = self._base(i, "") | values
        return i

    async def update_notice(self, notice_id, values):
        if notice_id not in self.data:
            return False
        self.data[notice_id].update(values)
        return True

    async def delete_notice(self, notice_id):
        return self.data.pop(notice_id, None) is not None


class FakeTx:
    def __init__(self, repo):
        self.repo, self.commits, self.rollbacks = repo, 0, 0

    async def commit(self):
        if self.repo.pending is not None:
            self.repo.saved, self.repo.pending = self.repo.pending, None
        self.commits += 1

    async def rollback(self):
        self.repo.pending = None
        self.rollbacks += 1


def make():
    repo = FakeRepo()
    tx = FakeTx(repo)
    return AdminNoticeService(repo, tx), repo, tx


# --- 도메인 ---
def test_draft_trims_title_and_body():
    draft = NoticeDraft(title="  배송 안내 ", body="  첫 줄\r\n둘째 줄  ")
    assert draft.title == "배송 안내" and draft.body == "첫 줄\n둘째 줄"


@pytest.mark.parametrize("title", ["", "   ", "가" * 101])
def test_bad_title_rejected(title):
    with pytest.raises(InvalidNotice):
        NoticeDraft(title=title)


def test_blank_body_becomes_none():
    assert NoticeDraft(title="t", body="   ").body is None


@pytest.mark.parametrize("values", [{}, {"title": None}, {"is_pinned": None}, {"unknown": 1}])
def test_bad_changes_rejected(values):
    with pytest.raises(InvalidNotice):
        NoticeChanges(values)


# --- 서비스 ---
def test_create_links_artist_and_product_then_commits():
    service, repo, tx = make()
    row = asyncio.run(service.create(NoticeDraft(title="발매 안내", artist_slug="bts", product_id=7, is_pinned=True)))
    assert (row.artist_slug, row.product_name, row.is_pinned) == ("bts", "응원봉", True)
    assert tx.commits == 1 and row.id in repo.saved


@pytest.mark.parametrize("kw", [{"artist_slug": "nobody"}, {"product_id": 999}])
def test_create_with_unknown_link_rolls_back(kw):
    service, repo, tx = make()
    with pytest.raises(InvalidNotice):
        asyncio.run(service.create(NoticeDraft(title="t", **kw)))
    assert tx.rollbacks == 1 and list(repo.saved) == [1]


def test_update_can_clear_artist():
    service, repo, _ = make()
    asyncio.run(service.update(1, NoticeChanges({"artist_slug": "bts"})))
    row = asyncio.run(service.update(1, NoticeChanges({"artist_slug": None, "title": "수정"})))
    assert row.artist_slug is None and row.title == "수정"


def test_update_and_delete_missing_is_404_and_rolled_back():
    service, _, tx = make()
    with pytest.raises(NoticeNotFound):
        asyncio.run(service.update(9, NoticeChanges({"title": "x"})))
    with pytest.raises(NoticeNotFound):
        asyncio.run(service.delete(9))
    assert tx.rollbacks == 2 and tx.commits == 0


# --- API ---
def build(role="ADMIN"):
    service, repo, tx = make()

    async def fake_require_admin():
        if role is None:
            raise ApiError(401, "NOT_AUTHENTICATED", "로그인이 필요해요.")
        if role != "ADMIN":
            raise ApiError(403, "UNKNOWN", "접근 권한이 없어요.")

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    app.dependency_overrides[require_admin] = fake_require_admin
    app.dependency_overrides[get_admin_notice_service] = lambda: service
    return TestClient(app), repo, tx


def test_crud_flow():
    client, repo, _ = build()
    created = client.post("/admin/notices", json={"title": "공지", "body": "## 안내\n- 하나", "artist_slug": "bts"})
    assert created.status_code == 201
    body = created.json()
    assert body["artist"] == {"slug": "bts", "name": "BTS"} and body["published_at"].startswith("2026-10-26")
    nid = body["id"]

    assert client.get("/admin/notices").json()["total"] == 2
    assert client.get(f"/admin/notices/{nid}").json()["title"] == "공지"

    patched = client.patch(f"/admin/notices/{nid}", json={"is_pinned": True, "artist_slug": None})
    assert patched.status_code == 200 and patched.json()["is_pinned"] and patched.json()["artist"] is None

    assert client.delete(f"/admin/notices/{nid}").status_code == 204
    assert client.get(f"/admin/notices/{nid}").status_code == 404


@pytest.mark.parametrize(
    "method,url,body",
    [
        ("post", "/admin/notices", {}),
        ("post", "/admin/notices", {"title": ""}),
        ("post", "/admin/notices", {"title": "가" * 101}),
        ("post", "/admin/notices", {"title": "t", "is_pinned": "yes"}),
        ("post", "/admin/notices", {"title": "t", "artist_slug": "BTS!"}),
        ("post", "/admin/notices", {"title": "t", "extra": 1}),
        ("post", "/admin/notices", {"title": "t", "product_id": 999}),
        ("patch", "/admin/notices/1", {}),
        ("patch", "/admin/notices/1", {"title": None}),
        ("patch", "/admin/notices/0", {"title": "x"}),
    ],
)
def test_invalid_is_422(method, url, body):
    client, repo, tx = build()
    res = getattr(client, method)(url, json=body)
    assert res.status_code == 422, res.json()
    assert set(res.json()) == {"code", "message"}
    assert list(repo.saved) == [1] and repo.saved[1]["title"] == "기존 공지"


def test_missing_notice_is_404():
    client, _, _ = build()
    assert client.patch("/admin/notices/9", json={"title": "x"}).json() == {
        "code": "UNKNOWN", "message": "공지를 찾을 수 없어요."}
    assert client.delete("/admin/notices/9").status_code == 404


@pytest.mark.parametrize("role,status", [(None, 401), ("USER", 403)])
def test_non_admin_blocked(role, status):
    client, repo, _ = build(role=role)
    assert client.get("/admin/notices").status_code == status
    assert client.post("/admin/notices", json={"title": "t"}).status_code == status
    assert client.delete("/admin/notices/1").status_code == status
    assert list(repo.saved) == [1]
