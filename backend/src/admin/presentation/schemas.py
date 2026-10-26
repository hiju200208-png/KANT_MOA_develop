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
