from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID, uuid4

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