# [presentation] 장바구니 요청·응답 모양 (JSON 필드는 팀 백엔드 공통인 snake_case)
from pydantic import BaseModel, ConfigDict, Field

from orders.domain.cart import MAX_MERGE_ITEMS, MAX_QUANTITY


class CartAddRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    variant_id: int = Field(ge=1, examples=[1])
    quantity: int = Field(ge=1, le=MAX_QUANTITY, examples=[1], description="이미 담긴 옵션이면 이 수량만큼 더한다")


class CartQuantityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity: int = Field(ge=1, le=MAX_QUANTITY, examples=[2], description="이 수량으로 바꾼다")


class GuestCartItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    variant_id: int = Field(ge=1)
    quantity: int = Field(description="0 이하 줄은 무시한다 (브라우저 저장값을 그대로 보내도 되게)")


class CartMergeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[GuestCartItem] = Field(max_length=MAX_MERGE_ITEMS,
                                       examples=[[{"variant_id": 1, "quantity": 2}]])


class CartProduct(BaseModel):
    id: int
    name: str
    thumbnail_url: str | None = Field(description="DB에 저장된 상대 경로 그대로 (예: /static/products/x.webp)")


class CartItemResponse(BaseModel):
    variant_id: int
    quantity: int
    product: CartProduct
    option_name: str
    unit_price: int = Field(description="현재 가격 = 상품 기본가 + 옵션 추가금")
    stock: int
    max_per_user: int | None = Field(description="null이면 구매 제한 없음")
    is_available: bool = Field(description="판매 중이고 재고가 담은 수량 이상이면 true")


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    total_quantity: int = Field(description="헤더 뱃지용 전체 수량")
    total_price: int = Field(description="표시용 합계 (is_available인 항목만)")
