"""관리자 상품 조회 저장소 (SQL, 조회 전용, commit/flush 없음).

테이블 구조 기준: backend/sql/001_create_tables.sql (10/26 상재님 공용 DB).
P2 ORM 모델이 main에 들어오면 같은 결과를 내는 ORM 조회로 바꿀 수 있다.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from admin.application.product_service import AdminProductFilters
from admin.domain.product_view import (
    LOW_STOCK_THRESHOLD,
    AdminProductDetailRow,
    AdminProductRow,
    AdminVariantRow,
)

_BASE_FROM = """
FROM products p
JOIN artists a ON a.id = p.artist_id
JOIN categories c ON c.id = p.category_id
LEFT JOIN (
    SELECT product_id,
           COALESCE(SUM(stock), 0) AS total_stock,
           COUNT(*) AS variant_count,
           BOOL_OR(stock <= :low_threshold) AS has_low_stock
    FROM product_variants
    GROUP BY product_id
) v ON v.product_id = p.id
"""

_SELECT_COLUMNS = """
SELECT p.id, p.name, a.slug AS artist_slug, a.name AS artist_name,
       c.slug AS category_slug, c.name AS category_name,
       p.price, p.status, p.thumbnail_path,
       COALESCE(v.total_stock, 0) AS total_stock,
       COALESCE(v.variant_count, 0) AS variant_count
"""

_ORDER_BY = {
    "latest": "p.created_at DESC, p.id DESC",
    "stock_asc": "COALESCE(v.total_stock, 0) ASC, p.id ASC",
    "name": "p.name ASC, p.id ASC",
}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_list_sql(filters: AdminProductFilters) -> tuple[str, str, dict]:
    """(목록 SQL, 개수 SQL, 파라미터). 값은 모두 바인딩 파라미터로만 넣는다."""
    where: list[str] = []
    params: dict = {"low_threshold": LOW_STOCK_THRESHOLD}
    if filters.q:
        where.append("p.name ILIKE :q ESCAPE '\\'")
        params["q"] = f"%{_escape_like(filters.q.strip())}%"
    if filters.artist:
        where.append("a.slug = :artist")
        params["artist"] = filters.artist
    if filters.category:
        where.append("c.slug = :category")
        params["category"] = filters.category
    if filters.status:
        where.append("p.status = :status")
        params["status"] = filters.status
    if filters.stock == "out":
        where.append("COALESCE(v.total_stock, 0) = 0")
    elif filters.stock == "low":
        where.append("COALESCE(v.has_low_stock, false)")

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    order_sql = _ORDER_BY.get(filters.sort, _ORDER_BY["latest"])
    params["limit"] = filters.size
    params["offset"] = (filters.page - 1) * filters.size
    list_sql = f"{_SELECT_COLUMNS} {_BASE_FROM} {where_sql} ORDER BY {order_sql} LIMIT :limit OFFSET :offset"
    count_sql = f"SELECT COUNT(*) {_BASE_FROM} {where_sql}"
    return list_sql, count_sql, params


def _to_row(m) -> AdminProductRow:
    return AdminProductRow(
        id=m["id"], name=m["name"],
        artist_slug=m["artist_slug"], artist_name=m["artist_name"],
        category_slug=m["category_slug"], category_name=m["category_name"],
        price=m["price"], status=m["status"], thumbnail_path=m["thumbnail_path"],
        total_stock=int(m["total_stock"]), variant_count=int(m["variant_count"]),
    )


class SqlAdminProductQueries:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_products(self, filters: AdminProductFilters) -> tuple[list[AdminProductRow], int]:
        list_sql, count_sql, params = build_list_sql(filters)
        count_params = {k: v for k, v in params.items() if k not in ("limit", "offset")}
        total = (await self._session.execute(text(count_sql), count_params)).scalar_one()
        rows = (await self._session.execute(text(list_sql), params)).mappings().all()
        return [_to_row(m) for m in rows], int(total)

    async def get_product(self, product_id: int) -> AdminProductDetailRow | None:
        sql = f"{_SELECT_COLUMNS} {_BASE_FROM} WHERE p.id = :product_id"
        row = (
            await self._session.execute(
                text(sql), {"product_id": product_id, "low_threshold": LOW_STOCK_THRESHOLD}
            )
        ).mappings().first()
        if row is None:
            return None
        variants = (
            await self._session.execute(
                text(
                    "SELECT id, option_name, extra_price, stock, max_per_user "
                    "FROM product_variants WHERE product_id = :product_id ORDER BY sort_order, id"
                ),
                {"product_id": product_id},
            )
        ).mappings().all()
        return AdminProductDetailRow(
            product=_to_row(row),
            variants=tuple(
                AdminVariantRow(
                    id=v["id"], option_name=v["option_name"], extra_price=v["extra_price"],
                    stock=v["stock"], max_per_user=v["max_per_user"],
                )
                for v in variants
            ),
        )
