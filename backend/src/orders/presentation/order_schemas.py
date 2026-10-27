# [presentation] 주문 요청·응답 모양 (JSON 필드는 팀 백엔드 공통인 snake_case)
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from orders.domain.checkout import MAX_DIRECT_QUANTITY, MAX_ORDER_ADDRESS, MAX_RECIPIENT_NAME

OrderStatusValue = Literal["pending", "paid", "cancelled"]


class OrderCreateRequest(BaseModel):
    """주문서 받는 분 정보. 가격·합계는 받지 않는다 (서버가 DB 값으로 계산)."""

    model_config = ConfigDict(extra="forbid")

    recipient_name: str = Field(max_length=MAX_RECIPIENT_NAME, examples=["김여름"])
    recipient_phone: str = Field(max_length=20, examples=["010-1234-5678"])
    address: str = Field(max_length=MAX_ORDER_ADDRESS, examples=["서울 강남구 테헤란로 1 101동 202호"],
                         description="기본주소 + 상세주소를 합친 문자열 (주문에 그대로 저장)")


class DirectOrderRequest(OrderCreateRequest):
    variant_id: int = Field(ge=1, examples=[1])
    # 범위(1~99)는 스키마가 아니라 도메인이 검사한다. 그래야 수량 오류가 약속대로 422/INVALID_ORDER로 나간다.
    # (스키마에서 막으면 공통 검증 처리기가 422/UNKNOWN으로 바꿔 버린다) 정수가 아닌 값은 여기서 422/UNKNOWN.
    quantity: int = Field(examples=[1], description=f"1~{MAX_DIRECT_QUANTITY}개. 벗어나면 422 INVALID_ORDER")


class ShippingPolicyResponse(BaseModel):
    free_shipping_threshold: int = Field(description="상품 금액이 이 이상이면 배송비 0원")
    shipping_fee: int = Field(description="기준 미만일 때 배송비. 설정이 없으면 0")


class OrderQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: OrderStatusValue | None = Field(default=None, description="주문 상태로 거르기")
    q: str | None = Field(default=None, max_length=50, description="주문 상품명 검색어")
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


class OrderItemResponse(BaseModel):
    variant_id: int
    product_name: str = Field(description="주문 당시 상품명")
    option_name: str = Field(description="주문 당시 옵션명")
    unit_price: int = Field(description="주문 당시 단가 (기본가 + 옵션 추가금)")
    quantity: int
    line_price: int


class OrderResponse(BaseModel):
    id: UUID
    status: OrderStatusValue
    items_price: int = Field(description="상품 금액")
    shipping_fee: int
    total_price: int = Field(description="실제 결제 금액 = 상품 금액 + 배송비")
    is_direct: bool = Field(description="바로 구매 주문이면 true")
    recipient_name: str
    recipient_phone: str
    address: str
    items: list[OrderItemResponse]
    created_at: datetime
    paid_at: datetime | None
    cancelled_at: datetime | None
