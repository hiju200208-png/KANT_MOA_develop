"""Google 로그인 업무 흐름과 외부 검증 인터페이스입니다."""
from typing import Protocol
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from auth.application.exceptions import AuthError
from auth.domain.google_identity import GoogleIdentity
from auth.domain.user import User, UserRole
from auth.infrastructure.repositories import UserRepository
from auth.infrastructure.security import create_access_token


class GoogleVerifier(Protocol):
    async def verify(self, credential: str, nonce: str) -> GoogleIdentity: ...


class GoogleAccountConflict(AuthError):
    def __init__(self):
        super().__init__("UNKNOWN", "같은 이메일로 가입된 계정이 있어요. 기존 로그인 방법을 이용해주세요.")


class GoogleLoginService:
    def __init__(self, session, verifier: GoogleVerifier):
        self.session = session
        self.users = UserRepository(session)
        self.verifier = verifier

    async def login(self, credential: str, nonce: str):
        identity = await self.verifier.verify(credential, nonce)
        try:
            user = await self.users.get_by_google_sub(identity.sub)
            if user is None:
                # 이메일만 같다고 기존 회원·관리자와 자동 연결하지 않습니다.
                if await self.users.get_by_email(identity.email) is not None:
                    raise GoogleAccountConflict()
                user = await self.users.add(User(
                    id=uuid4(), email=identity.email, nickname=identity.nickname,
                    password_hash=None, google_sub=identity.sub, role=UserRole.USER,
                ))
                await self.session.commit()
            return create_access_token(user.id)
        except IntegrityError:
            await self.session.rollback()
            # 동시 최초 가입의 동일 sub만 재조회하고 다른 계정은 합치지 않습니다.
            user = await self.users.get_by_google_sub(identity.sub)
            if user is not None:
                return create_access_token(user.id)
            raise GoogleAccountConflict() from None
        except Exception:
            await self.session.rollback()
            raise
