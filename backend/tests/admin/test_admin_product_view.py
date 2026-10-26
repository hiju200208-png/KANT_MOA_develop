import pytest
from pydantic import ValidationError

from admin.domain.product_view import (
    LOW_STOCK_THRESHOLD,
    is_sold_out,
    summarize_stock,
)
from admin.presentation.schemas import (
    AdminProductDetail,
    AdminProductListItem,
    AdminProductQuery,
)
from core.schemas import PageResponse


@pytest.mark.parametrize(
    ("status", "total", "expected"),
    [
        ("on_sale", 0, True),      # 판매 중 + 재고 0 → 계산상 품절
        ("on_sale", 3, False),
        ("sold_out", 10, True),    # 관리자가 직접 정한 품절은 유지
        ("hidden", 0, False),      # 숨김은 품절과 별개, status로 표시
        ("hidden", 10, False),
    ],
)
def test_is_sold_out_rule(status, total, expected):
    assert is_sold_out(status, total) is expected


def test_is_sold_out_rejects_unknown_status():
    with pytest.raises(ValueError):
        is_sold_out("deleted", 0)


def test_summarize_stock():
    summary = summarize_stock([37, 0, LOW_STOCK_THRESHOLD + 1])
    assert (summary.total_stock, summary.variant_count, summary.has_low_stock) == (43, 3, True)
    assert summarize_stock([LOW_STOCK_THRESHOLD + 1]).has_low_stock is False
    empty = summarize_stock([])
    assert (empty.total_stock, empty.variant_count, empty.has_low_stock) == (0, 0, False)
    with pytest.raises(ValueError):
        summarize_stock([1, -1])


ITEM = {
    "id": 12,
    "name": "BTS 공식 응원봉 SE",
    "artist": {"slug": "bts", "name": "BTS"},
    "category": {"slug": "cheering", "name": "응원용품"},
    "price": 45000,
    "status": "on_sale",
    "thumbnail_url": "/static/products/bts/main.webp",
}


def test_list_item_and_page_shape_match_api_contract():
    item = AdminProductListItem(**ITEM, total_stock=37, variant_count=1, is_sold_out=False)
    page = PageResponse[AdminProductListItem](items=[item], total=387, page=1, size=20)
    body = page.model_dump()
    assert set(body) == {"items", "total", "page", "size"}
    assert set(body["items"][0]) == {
        "id", "name", "artist", "category", "price", "status",
        "thumbnail_url", "total_stock", "variant_count", "is_sold_out",
    }


def test_detail_includes_variants():
    detail = AdminProductDetail(
        **ITEM,
        is_sold_out=False,
        variants=[{"id": 301, "option_name": "기본", "extra_price": 0, "stock": 37, "max_per_user": 4}],
    )
    assert detail.variants[0].stock == 37


def test_list_item_rejects_negative_stock_and_unknown_status():
    with pytest.raises(ValidationError):
        AdminProductListItem(**ITEM, total_stock=-1, variant_count=1, is_sold_out=False)
    with pytest.raises(ValidationError):
        AdminProductListItem(**{**ITEM, "status": "deleted"}, total_stock=1, variant_count=1, is_sold_out=False)


def test_query_defaults_and_validation():
    query = AdminProductQuery()
    assert (query.sort, query.page, query.size) == ("latest", 1, 20)
    assert AdminProductQuery(stock="low", status="hidden", sort="stock_asc").stock == "low"
    for bad in ({"page": 0}, {"size": 101}, {"sort": "price"}, {"stock": "none"}, {"status": "deleted"}, {"unknown": 1}):
        with pytest.raises(ValidationError):
            AdminProductQuery(**bad)
