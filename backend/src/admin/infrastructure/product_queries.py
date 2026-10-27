"""관리자 상품 조회 저장소 (조회 전용, commit/flush 없음).

P2 ORM 모델(products.infrastructure.models)을 재사용한다 (10/26 상재님 요청).
숨김 상품까지 포함하는 관리자 전용 조회라 P4에 두고, 테이블 매핑은 P2 한 곳만 쓴다.
"""

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from admin.application.product_service import AdminProductFilters
from admin.domain.product_view import (
    LOW_STOCK_THRESHOLD,
    AdminDashboardSummary,
    AdminProductDetailRow,
    AdminProductRow,
    AdminVariantRow,
)
from products.infrastructure.models import ArtistModel, CategoryModel, ProductModel, ProductVariantModel

P, A, C, V = ProductModel, ArtistModel, CategoryModel, ProductVariantModel

# 상품별 옵션 재고 합계·옵션 수·재고 부족 옵션 존재 여부
_variant_summary = (
    select(
        V.product_id.label("product_id"),
        func.coalesce(func.sum(V.stock), 0).label("total_stock"),
        func.count(V.id).label("variant_count"),
        func.bool_or(V.stock <= LOW_STOCK_THRESHOLD).label("has_low_stock"),
    )
    .group_by(V.product_id)
    .subquery("v")
)
_total_stock = func.coalesce(_variant_summary.c.total_stock, 0)
_variant_count = func.coalesce(_variant_summary.c.variant_count, 0)

_ORDER_BY = {
    "latest": (P.created_at.desc(), P.id.desc()),
    "stock_asc": (_total_stock.asc(), P.id.asc()),
    "name": (P.name.asc(), P.id.asc()),
}


def _joined(stmt: Select) -> Select:
    return (
        stmt.select_from(P)
        .join(A, A.id == P.artist_id)
        .join(C, C.id == P.category_id)
        .outerjoin(_variant_summary, _variant_summary.c.product_id == P.id)
    )


def _row_select() -> Select:
    return _joined(
        select(
            P.id, P.name,
            A.slug.label("artist_slug"), A.name.label("artist_name"),
            C.slug.label("category_slug"), C.name.label("category_name"),
            P.price, P.status, P.thumbnail_path,
            _total_stock.label("total_stock"), _variant_count.label("variant_count"),
        )
    )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _conditions(filters: AdminProductFilters) -> list:
    conditions = []
    if filters.q and filters.q.strip():
        conditions.append(P.name.ilike(f"%{_escape_like(filters.q.strip())}%", escape="\\"))
    if filters.artist:
        conditions.append(A.slug == filters.artist)
    if filters.category:
        conditions.append(C.slug == filters.category)
    if filters.status:
        conditions.append(P.status == filters.status)
    if filters.stock == "out":
        conditions.append(_total_stock == 0)
    elif filters.stock == "low":
        conditions.append(func.coalesce(_variant_summary.c.has_low_stock, False))
    return conditions


def build_list_query(filters: AdminProductFilters) -> tuple[Select, Select]:
    """(목록 쿼리, 개수 쿼리). 사용자 입력은 모두 바인딩 파라미터로만 들어간다."""
    conditions = _conditions(filters)
    order_by = _ORDER_BY.get(filters.sort, _ORDER_BY["latest"])
    list_stmt = (
        _row_select().where(*conditions).order_by(*order_by)
        .limit(filters.size).offset((filters.page - 1) * filters.size)
    )
    count_stmt = _joined(select(func.count(P.id))).where(*conditions)
    return list_stmt, count_stmt


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
        list_stmt, count_stmt = build_list_query(filters)
        total = (await self._session.execute(count_stmt)).scalar_one()
        rows = (await self._session.execute(list_stmt)).mappings().all()
        return [_to_row(m) for m in rows], int(total)

    async def get_product(self, product_id: int) -> AdminProductDetailRow | None:
        row = (await self._session.execute(_row_select().where(P.id == product_id))).mappings().first()
        if row is None:
            return None
        variants = (
            await self._session.execute(
                select(V.id, V.option_name, V.extra_price, V.stock, V.max_per_user)
                .where(V.product_id == product_id)
                .order_by(V.sort_order, V.id)
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

    async def dashboard_summary(self) -> AdminDashboardSummary:
        """목록 필터와 같은 조건으로 센다 (status 필터, stock=out, stock=low)."""
        has_low = func.coalesce(_variant_summary.c.has_low_stock, False)
        row = (
            await self._session.execute(
                select(
                    func.count(P.id).label("total"),
                    func.count(P.id).filter(P.status == "on_sale").label("on_sale"),
                    func.count(P.id).filter(P.status == "sold_out").label("sold_out"),
                    func.count(P.id).filter(P.status == "hidden").label("hidden"),
                    func.count(P.id).filter(_total_stock == 0).label("out_of_stock"),
                    func.count(P.id).filter(has_low).label("low_stock"),
                )
                .select_from(P)
                .outerjoin(_variant_summary, _variant_summary.c.product_id == P.id)
            )
        ).mappings().one()
        return AdminDashboardSummary(**{k: int(v) for k, v in row.items()})
