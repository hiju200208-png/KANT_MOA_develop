import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://unused:unused@localhost/unused")

from sqlalchemy.dialects import postgresql

from admin.infrastructure.product_queries import build_list_query
from admin.presentation.schemas import AdminProductQuery

DIALECT = postgresql.dialect()


def compiled(stmt):
    c = stmt.compile(dialect=DIALECT)
    return str(c), c.params


def test_uses_p2_orm_tables_and_latest_order_by_default():
    list_stmt, count_stmt = build_list_query(AdminProductQuery())
    sql, params = compiled(list_stmt)
    count_sql, _ = compiled(count_stmt)
    for table in ("FROM products JOIN artists", "JOIN categories", "product_variants"):
        assert table in sql
    assert "WHERE" not in sql.split("FROM products")[1].split("ORDER BY")[0].replace("GROUP BY", "")
    assert "ORDER BY products.created_at DESC, products.id DESC" in sql
    assert params["param_1"] == 20 and params["param_2"] == 0  # LIMIT 20 OFFSET 0
    assert "count(products.id)" in count_sql


def test_hidden_products_are_not_excluded_by_default():
    sql, params = compiled(build_list_query(AdminProductQuery())[0])
    assert "hidden" not in sql and "hidden" not in params.values()


def test_filters_use_bind_params_only():
    query = AdminProductQuery(q="응원봉", artist="bts", category="lightstick", status="hidden", stock="low",
                              sort="stock_asc", page=3, size=10)
    list_stmt, count_stmt = build_list_query(query)
    sql, params = compiled(list_stmt)
    count_sql, count_params = compiled(count_stmt)
    for fragment in ("products.name ILIKE", "artists.slug =", "categories.slug =", "products.status =", "has_low_stock"):
        assert fragment in sql and fragment in count_sql
    assert "bts" not in sql and "응원봉" not in sql
    values = set(map(str, params.values()))
    assert {"%응원봉%", "bts", "lightstick", "hidden", "10", "20"} <= values
    order = sql.split("ORDER BY")[1]
    assert order.strip().startswith("coalesce(v.total_stock") and "ASC, products.id ASC" in order


def test_like_wildcards_are_escaped():
    _, params = compiled(build_list_query(AdminProductQuery(q="50%_off\\"))[0])
    assert "%50\\%\\_off\\\\%" in params.values()


def test_out_of_stock_filter():
    sql, _ = compiled(build_list_query(AdminProductQuery(stock="out"))[0])
    where = sql.split("WHERE")[-1].split("ORDER BY")[0]
    assert where.strip().startswith("coalesce(v.total_stock") and " = " in where
