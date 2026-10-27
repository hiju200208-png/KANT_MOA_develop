"""관리자 API 요청·응답 스키마 (Pydantic). 입력 형식 오류는 공통 핸들러가 422로 응답한다.

상품 목록·상세 응답 스키마는 P2 상품 모델(필드 이름·id 타입)이 정해진 뒤 추가한다.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator

from admin.domain.stock_adjustment import MAX_CHANGE, MAX_REASON_LENGTH, MIN_CHANGE

ProductStatus = Literal["on_sale", "sold_out", "hidden"]


class StockAdjustmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change: StrictInt = Field(ge=MIN_CHANGE, le=MAX_CHANGE, description="늘릴 수량(+) 또는 줄일 수량(-), 0 불가")
    reason: str | None = Field(default=None, max_length=MAX_REASON_LENGTH, description="입고, 불량, 재고 실사 등")

    @field_validator("change")
    @classmethod
    def change_not_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("change must not be 0")
        return value


class StockAdjustmentResponse(BaseModel):
    variant_id: int
    before: int = Field(ge=0)
    after: int = Field(ge=0)
    change: int


class ProductStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ProductStatus


# --- 관리자 상품 목록·상세 응답 (P4 API 계약, docs/admin/P4_ADMIN.md 3-1·3-2) ---
# P2 상품 모델이 나오면 infrastructure에서 이 모양으로 바꿔 담는다. 필드 이름은 API 계약 기준.

ProductStockFilter = Literal["out", "low"]
ProductSort = Literal["latest", "stock_asc", "name"]


class NamedRef(BaseModel):
    slug: str
    name: str


class AdminVariantItem(BaseModel):
    id: int
    option_name: str
    extra_price: int = 0
    stock: int = Field(ge=0)
    max_per_user: int | None = Field(default=None, ge=1)


class AdminProductBase(BaseModel):
    id: int
    name: str
    artist: NamedRef
    category: NamedRef | None = None
    price: int = Field(ge=0)
    status: ProductStatus
    thumbnail_url: str | None = Field(default=None, description="/static/... 또는 /uploads/... 상대 경로")


class AdminProductListItem(AdminProductBase):
    total_stock: int = Field(ge=0)
    variant_count: int = Field(ge=0)
    is_sold_out: bool


class AdminProductDetail(AdminProductBase):
    is_sold_out: bool
    variants: list[AdminVariantItem]


class AdminProductQuery(BaseModel):
    """GET /admin/products 쿼리. 잘못된 값은 422."""

    model_config = ConfigDict(extra="forbid")

    q: str | None = Field(default=None, max_length=100)
    artist: str | None = None
    category: str | None = None
    status: ProductStatus | None = None
    stock: ProductStockFilter | None = None
    sort: ProductSort = "latest"
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


# --- 관리자 공지 (P4 선택 기능, docs/admin/P4_ADMIN.md 3-7) ---

NOTICE_SLUG = r"^[a-z0-9][a-z0-9-]{0,63}$"


class NoticeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=100)
    body: str | None = Field(default=None, max_length=5000, description="줄 단위로 표시 (## 섹션, - 목록 등)")
    artist_slug: str | None = Field(default=None, pattern=NOTICE_SLUG, description="없으면 전체 공지")
    product_id: int | None = Field(default=None, ge=1, description="상세 하단 '상품 보러가기'")
    is_pinned: StrictBool = False
    show_in_topbar: StrictBool = False


class NoticeUpdate(BaseModel):
    """보낸 필드만 바꾼다. artist_slug·product_id·body는 null로 보내면 연결/내용을 지운다."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=100)
    body: str | None = Field(default=None, max_length=5000)
    artist_slug: str | None = Field(default=None, pattern=NOTICE_SLUG)
    product_id: int | None = Field(default=None, ge=1)
    is_pinned: StrictBool | None = None
    show_in_topbar: StrictBool | None = None


class AdminNoticeItem(BaseModel):
    id: int
    title: str
    body: str | None
    artist: NamedRef | None = Field(default=None, description="null = 전체 공지")
    product_id: int | None
    product_name: str | None
    is_pinned: bool
    show_in_topbar: bool
    published_at: datetime


class AdminNoticeQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artist: str | None = Field(default=None, description="아티스트 slug, all = 전체 공지만")
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


# --- 대시보드·상태 일괄 변경 ---


class AdminDashboard(BaseModel):
    total: int = Field(ge=0, description="전체 상품 (숨김 포함)")
    on_sale: int = Field(ge=0)
    sold_out: int = Field(ge=0, description="관리자가 직접 품절 처리한 상품")
    hidden: int = Field(ge=0)
    out_of_stock: int = Field(ge=0, description="옵션 재고 합계 0 (목록 stock=out과 같음)")
    low_stock: int = Field(ge=0, description="재고 5개 이하 옵션이 있음 (목록 stock=low와 같음)")


class ProductBulkStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_ids: list[StrictInt] = Field(min_length=1, max_length=100)
    status: ProductStatus


class ProductBulkStatusResult(BaseModel):
    status: ProductStatus
    product_ids: list[int]
    updated: int
