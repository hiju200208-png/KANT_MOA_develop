import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

from admin.infrastructure.product_queries import build_list_sql
from admin.presentation.schemas import AdminProductQuery


def test_default_query_has_no_where_and_latest_order():
    list_sql, count_sql, params = build_list_sql(AdminProductQuery())
    assert "WHERE" not in list_sql and "WHERE" not in count_sql
    assert "ORDER BY p.created_at DESC, p.id DESC" in list_sql
    assert params == {"low_threshold": 5, "limit": 20, "offset": 0}


def test_hidden_products_are_not_excluded_by_default():
    list_sql, _, _ = build_list_sql(AdminProductQuery())
    assert "hidden" not in list_sql


def test_filters_use_bind_params_only():
    query = AdminProductQuery(
        q="응원봉", artist="bts", category="lightstick", status="hidden", stock="low",
        sort="stock_asc", page=3, size=10,
    )
    list_sql, count_sql, params = build_list_sql(query)
    for fragment in ("p.name ILIKE :q", "a.slug = :artist", "c.slug = :category", "p.status = :status",
                     "has_low_stock"):
        assert fragment in list_sql and fragment in count_sql
    assert "bts" not in list_sql and "응원봉" not in list_sql
    assert params["q"] == "%응원봉%"
    assert (params["limit"], params["offset"]) == (10, 20)
    assert "COALESCE(v.total_stock, 0) ASC" in list_sql


def test_like_wildcards_are_escaped():
    _, _, params = build_list_sql(AdminProductQuery(q="50%_off\\"))
    assert params["q"] == "%50\\%\\_off\\\\%"


def test_out_of_stock_filter():
    list_sql, _, _ = build_list_sql(AdminProductQuery(stock="out"))
    assert "COALESCE(v.total_stock, 0) = 0" in list_sql
