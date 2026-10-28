"""검증을 통과한 Google 회원 정보. 외부 토큰·프레임워크는 포함하지 않습니다."""
from dataclasses import dataclass

from auth.domain.exceptions import InvalidUserError


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    nickname: str

    def __post_init__(self):
        if not self.sub.strip() or not self.email.strip() or not self.nickname.strip():
            raise InvalidUserError("Google 회원 정보가 올바르지 않아요.")
