# [presentation] 배송지 요청·응답 모양 (JSON 필드는 팀 백엔드 공통인 snake_case)
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from orders.domain.address import MAX_ADDRESS, MAX_LABEL, MAX_NAME


class AddressRequest(BaseModel):
    """배송지 등록·수정 요청. 형식(타입·길이)만 여기서 보고, 업무 규칙 검사는 도메인이 한다."""

    model_config = ConfigDict(extra="forbid")

    label: str | None = Field(default=None, max_length=MAX_LABEL, examples=["집"])
    recipient_name: str = Field(max_length=MAX_NAME, examples=["김여름"])
    recipient_phone: str = Field(max_length=20, examples=["010-1234-5678"])
    postal_code: str = Field(max_length=10, examples=["06236"])
    address1: str = Field(max_length=MAX_ADDRESS, examples=["서울 강남구 테헤란로 1"])
    address2: str | None = Field(default=None, max_length=MAX_ADDRESS, examples=["101동 202호"])
    is_default: bool = Field(default=False, description="true면 기본 배송지로 지정. false는 무시 (기본 해제는 다른 배송지를 기본으로 지정)")


class AddressQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str | None = Field(default=None, max_length=50, description="배송지명·받는 분·주소 검색어")
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


class AddressResponse(BaseModel):
    id: int
    label: str | None
    recipient_name: str
    recipient_phone: str
    postal_code: str
    address1: str
    address2: str | None
    is_default: bool
    created_at: datetime
