"""관리자 상품 목록·상세에 내려줄 계산 규칙 (순수 Python).

품절 규칙 (10/26 상재님 PR #1 답변):
- DB의 status는 재고 때문에 자동으로 바꾸지 않는다.
- 판매 중(on_sale)인데 옵션 재고 합계가 0이면 is_sold_out=True로 계산해서 내려준다.
- 관리자가 직접 정한 hidden·sold_out은 그대로 유지한다.
  (status가 sold_out이면 is_sold_out=True, hidden은 품절 여부와 별개로 숨김 상태로 표시)
"""

from collections.abc import Iterable
from dataclasses import dataclass

from admin.domain.stock_adjustment import AdminDomainError

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


# --- 관리자 조회 결과 (저장소가 돌려주는 값, 순수 데이터) ---


@dataclass(frozen=True)
class AdminProductRow:
    id: int
    name: str
    artist_slug: str
    artist_name: str
    category_slug: str
    category_name: str
    price: int
    status: str
    thumbnail_path: str | None
    total_stock: int
    variant_count: int

    @property
    def is_sold_out(self) -> bool:
        return is_sold_out(self.status, self.total_stock)


@dataclass(frozen=True)
class AdminVariantRow:
    id: int
    option_name: str
    extra_price: int
    stock: int
    max_per_user: int | None


@dataclass(frozen=True)
class AdminProductDetailRow:
    product: AdminProductRow
    variants: tuple[AdminVariantRow, ...]


def to_public_image_path(path: str | None, bucket: str = "products") -> str | None:
    """DB 이미지 경로 → 화면용 상대 경로.

    잠정 규칙 (P2 이미지 이관 규칙 확정 전): 이미 '/'로 시작하면 그대로,
    버킷 내 경로(예: 'bts/12/main.webp')면 '/static/<bucket>/' 를 앞에 붙인다.
    """
    if not path:
        return None
    if path.startswith("/"):
        return path
    return f"/static/{bucket}/{path}"


# --- 판매 상태 변경 (PATCH /admin/products/{id}) ---


class InvalidProductStatus(AdminDomainError):
    """on_sale·sold_out·hidden 외의 값 → 422."""

    message = "판매 상태 값을 확인해주세요."


def ensure_product_status(status: str) -> str:
    """관리자가 바꿀 수 있는 상태인지 확인한다.

    세 상태 사이는 자유롭게 바꿀 수 있다. 재고가 0인 상품을 on_sale로 바꿔도 막지 않고,
    목록·상세에서 is_sold_out=True로 계산해서 보여준다 (상재님 답변: 상태 자동 변경 없음).
    """
    if status not in PRODUCT_STATUSES:
        raise InvalidProductStatus()
    return status


# --- 관리자 대시보드 요약 (GET /admin/dashboard) ---
# 숫자마다 목록 필터와 같은 기준을 써서, 카드를 누르면 같은 개수의 목록이 나온다.


@dataclass(frozen=True)
class AdminDashboardSummary:
    total: int          # 전체 상품 (숨김 포함)
    on_sale: int        # status=on_sale
    sold_out: int       # status=sold_out (관리자가 직접 품절 처리)
    hidden: int         # status=hidden
    out_of_stock: int   # 옵션 재고 합계 0 (stock=out 필터와 같음)
    low_stock: int      # 재고 5개 이하 옵션이 있음 (stock=low 필터와 같음)


# --- 판매 상태 일괄 변경 ---
MAX_BULK_PRODUCTS = 100


class InvalidBulkRequest(AdminDomainError):
    """빈 목록·중복·개수 초과 → 422."""

    message = "바꿀 상품을 1~100개 골라주세요."


def ensure_bulk_product_ids(product_ids: list[int]) -> list[int]:
    if not 1 <= len(product_ids) <= MAX_BULK_PRODUCTS or len(set(product_ids)) != len(product_ids):
        raise InvalidBulkRequest()
    if any(type(i) is not int or i <= 0 for i in product_ids):
        raise InvalidBulkRequest()
    return sorted(product_ids)
