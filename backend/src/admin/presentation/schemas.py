"""관리자 API 요청·응답 스키마 (Pydantic). 입력 형식 오류는 공통 핸들러가 422로 응답한다.

상품 목록·상세 응답 스키마는 P2 상품 모델(필드 이름·id 타입)이 정해진 뒤 추가한다.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

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
