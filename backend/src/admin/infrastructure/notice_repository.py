"""관리자 공지 저장소 (SQL, commit 없음). 테이블 기준: backend/sql/001_create_tables.sql notices."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from admin.domain.notice import AdminNoticeRow

_SELECT = """
SELECT n.id, n.title, n.body, a.slug AS artist_slug, a.name AS artist_name,
       n.product_id, p.name AS product_name, n.is_pinned, n.show_in_topbar, n.published_at
FROM notices n
LEFT JOIN artists a ON a.id = n.artist_id
LEFT JOIN products p ON p.id = n.product_id
"""

# 바꿀 수 있는 컬럼만 허용 (SQL에 들어가는 이름은 이 목록에서만 나온다)
_WRITABLE = ("title", "body", "artist_id", "product_id", "is_pinned", "show_in_topbar")


def _row(m) -> AdminNoticeRow:
    return AdminNoticeRow(**{k: m[k] for k in AdminNoticeRow.__dataclass_fields__})


def _columns(values: dict) -> list[str]:
    columns = [c for c in _WRITABLE if c in values]
    if set(values) - set(columns):
        raise ValueError("허용되지 않은 컬럼")
    return columns


class SqlAdminNoticeRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_notices(self, artist: str | None, page: int, size: int):
        where, params = "", {"limit": size, "offset": (page - 1) * size}
        if artist == "all":  # 전체 공지만
            where = "WHERE n.artist_id IS NULL"
        elif artist:
            where = "WHERE a.slug = :artist"
            params["artist"] = artist
        count_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
        total = (
            await self._session.execute(
                text(f"SELECT COUNT(*) FROM notices n LEFT JOIN artists a ON a.id = n.artist_id {where}"),
                count_params,
            )
        ).scalar_one()
        rows = (
            await self._session.execute(
                text(f"{_SELECT} {where} ORDER BY n.is_pinned DESC, n.published_at DESC, n.id DESC "
                     "LIMIT :limit OFFSET :offset"),
                params,
            )
        ).mappings().all()
        return [_row(m) for m in rows], int(total)

    async def get_notice(self, notice_id: int) -> AdminNoticeRow | None:
        m = (await self._session.execute(text(f"{_SELECT} WHERE n.id = :id"), {"id": notice_id})).mappings().first()
        return _row(m) if m else None

    async def find_artist_id(self, slug: str) -> int | None:
        return (
            await self._session.execute(text("SELECT id FROM artists WHERE slug = :slug"), {"slug": slug})
        ).scalar_one_or_none()

    async def product_exists(self, product_id: int) -> bool:
        return (
            await self._session.execute(text("SELECT 1 FROM products WHERE id = :id"), {"id": product_id})
        ).scalar_one_or_none() is not None

    async def insert_notice(self, values: dict) -> int:
        columns = _columns(values)
        sql = (f"INSERT INTO notices ({', '.join(columns)}) "
               f"VALUES ({', '.join(':' + c for c in columns)}) RETURNING id")
        return (await self._session.execute(text(sql), {c: values[c] for c in columns})).scalar_one()

    async def update_notice(self, notice_id: int, values: dict) -> bool:
        columns = _columns(values)
        sql = f"UPDATE notices SET {', '.join(f'{c} = :{c}' for c in columns)} WHERE id = :id RETURNING id"
        params = {c: values[c] for c in columns} | {"id": notice_id}
        return (await self._session.execute(text(sql), params)).scalar_one_or_none() is not None

    async def delete_notice(self, notice_id: int) -> bool:
        result = await self._session.execute(text("DELETE FROM notices WHERE id = :id RETURNING id"), {"id": notice_id})
        return result.scalar_one_or_none() is not None
