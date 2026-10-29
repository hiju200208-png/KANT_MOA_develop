from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID, uuid4
import re

from .exceptions import InvalidUserError


class UserRole(StrEnum):
    USER = "USER"
    ADMIN = "ADMIN"


@dataclass
class User:
    id: UUID
    email: str
    nickname: str
    password_hash: str | None
    google_sub: str | None = None
    phone: str | None = None
    role: UserRole = UserRole.USER

    def __post_init__(self) -> None:
        self.email = self.email.strip().lower()
        self.nickname = self.nickname.strip()

        if not self.email:
            raise InvalidUserError("이메일은 비어 있을 수 없습니다.")

        if not self.nickname:
            raise InvalidUserError("닉네임은 비어 있을 수 없습니다.")

        if not (self.password_hash or self.google_sub):
            raise InvalidUserError("로그인 수단이 하나 이상 필요합니다.")

        try:
            self.role = UserRole(self.role)
        except ValueError as exc:
            raise InvalidUserError("허용되지 않은 회원 역할입니다.") from exc

    @classmethod
    def register(
        cls,
        email: str,
        nickname: str,
        password_hash: str,
    ) -> "User":
        if not password_hash:
            raise InvalidUserError("비밀번호 해시가 필요합니다.")

        return cls(
            id=uuid4(),
            email=email,
            nickname=nickname,
            password_hash=password_hash,
            role=UserRole.USER,
        )

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    def update_profile(self, changes: dict) -> dict:
        """닉네임·연락처만 검증하고 전체 입력이 유효할 때 함께 반영합니다."""
        if not changes or set(changes) - {"nickname", "phone"}:
            raise InvalidUserError("변경할 닉네임 또는 연락처를 입력해주세요.")
        normalized = {}
        if "nickname" in changes:
            nickname = changes["nickname"]
            if not isinstance(nickname, str) or not 1 <= len(nickname.strip()) <= 50:
                raise InvalidUserError("닉네임은 1~50자로 입력해주세요.")
            normalized["nickname"] = nickname.strip()
        if "phone" in changes:
            phone = changes["phone"]
            if phone is not None:
                if not isinstance(phone, str):
                    raise InvalidUserError("연락처 형식을 확인해주세요.")
                phone = phone.strip() or None
            if phone is not None and (len(phone) > 20 or not re.fullmatch(r"[0-9 -]+", phone)
                    or not re.fullmatch(r"01[0-9]{8,9}", re.sub(r"[ -]", "", phone))):
                raise InvalidUserError("휴대폰 번호를 정확히 입력해주세요.")
            normalized["phone"] = phone
        for field, value in normalized.items():
            setattr(self, field, value)
        return normalized
