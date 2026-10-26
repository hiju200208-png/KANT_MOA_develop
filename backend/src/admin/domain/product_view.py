"""관리자 상품 목록·상세에 내려줄 계산 규칙 (순수 Python).

품절 규칙 (10/26 상재님 PR #1 답변):
- DB의 status는 재고 때문에 자동으로 바꾸지 않는다.
- 판매 중(on_sale)인데 옵션 재고 합계가 0이면 is_sold_out=True로 계산해서 내려준다.
- 관리자가 직접 정한 hidden·sold_out은 그대로 유지한다.
  (status가 sold_out이면 is_sold_out=True, hidden은 품절 여부와 별개로 숨김 상태로 표시)
"""

from collections.abc import Iterable
from dataclasses import dataclass

ON_SALE = "on_sale"
SOLD_OUT = "sold_out"
HIDDEN = "hidden"
PRODUCT_STATUSES = (ON_SALE, SOLD_OUT, HIDDEN)

LOW_STOCK_THRESHOLD = 5  # 목록 필터 stock=low: 옵션 중 하나라도 재고 ≤ 5


@dataclass(frozen=True)
class StockSummary:
    total_stock: int
    variant_count: int
    has_low_stock: bool


def summarize_stock(variant_stocks: Iterable[int]) -> StockSummary:
    stocks = list(variant_stocks)
    if any(stock < 0 for stock in stocks):
        raise ValueError("재고는 0보다 작을 수 없어요.")
    return StockSummary(
        total_stock=sum(stocks),
        variant_count=len(stocks),
        has_low_stock=any(stock <= LOW_STOCK_THRESHOLD for stock in stocks),
    )


def is_sold_out(status: str, total_stock: int) -> bool:
    if status not in PRODUCT_STATUSES:
        raise ValueError(f"알 수 없는 판매 상태예요: {status}")
    if status == SOLD_OUT:
        return True
    return status == ON_SALE and total_stock <= 0
