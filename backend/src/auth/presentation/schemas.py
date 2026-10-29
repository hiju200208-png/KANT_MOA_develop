from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    # role 같은 정의되지 않은 입력은 거부합니다.
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    nickname: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("nickname", mode="before")
    @classmethod
    def normalize_nickname(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value


class UserResponse(BaseModel):
    id: UUID
    email: str
    nickname: str
    role: Literal["USER", "ADMIN"]
    phone: str | None = None


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nickname: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("nickname")
    @classmethod
    def require_nickname(cls, value):
        if value is None or not value.strip():
            raise ValueError("닉네임을 입력해주세요.")
        return value.strip()


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class GoogleLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    credential: str = Field(min_length=1, max_length=16384)
    nonce: str = Field(min_length=32, max_length=128)


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


class PasswordResetRequestResponse(BaseModel):
    message: str
    # 시연 모드에서만 채워집니다. 운영에서는 항상 None(메일로만 전달).
    reset_token: str | None = None


class PasswordResetConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=2048)
    new_password: str = Field(min_length=8, max_length=128)
