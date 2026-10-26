from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.exceptions import (
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    NotAuthenticatedError,
)
from auth.domain.user import User, UserRole
from auth.infrastructure.repositories import (
    TokenBlacklistRepository,
    UserRepository,
)
from auth.infrastructure.security import (
    AccessToken,
    InvalidTokenError,
    TokenClaims,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.users = UserRepository(session)
        self.blacklist = TokenBlacklistRepository(session)

    async def signup(
        self,
        email: str,
        nickname: str,
        password: str,
    ) -> User:
        try:
            existing = await self.users.get_by_email(email)

            if existing is not None:
                raise EmailAlreadyExistsError()

            user = User.register(
                email=email,
                nickname=nickname,
                password_hash=hash_password(password),
            )

            await self.users.add(user)
            await self.session.commit()

            return user

        except IntegrityError as exc:
            await self.session.rollback()

            if await self.users.get_by_email(email) is not None:
                raise EmailAlreadyExistsError() from exc

            raise

        except Exception:
            await self.session.rollback()
            raise

    async def create_admin(
        self,
        email: str,
        nickname: str,
        password: str,
    ) -> User:
        # CLI는 회원가입 요청 스키마를 거치지 않으므로 별도 검증합니다.
        if not 8 <= len(password) <= 128:
            raise ValueError("비밀번호는 8~128자여야 합니다.")

        try:
            existing = await self.users.get_by_email(email)

            if existing is not None:
                raise EmailAlreadyExistsError()

            user = User(
                id=uuid4(),
                email=email,
                nickname=nickname,
                password_hash=hash_password(password),
                role=UserRole.ADMIN,
            )

            await self.users.add(user)
            await self.session.commit()

            return user

        except IntegrityError as exc:
            await self.session.rollback()

            if await self.users.get_by_email(email) is not None:
                raise EmailAlreadyExistsError() from exc

            raise

        except Exception:
            await self.session.rollback()
            raise

    async def login(
        self,
        email: str,
        password: str,
    ) -> AccessToken:
        user = await self.users.get_by_email(email)

        if user is None or user.password_hash is None:
            raise InvalidCredentialsError()

        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        return create_access_token(user.id)

    async def authenticate(
        self,
        token: str,
    ) -> tuple[User, TokenClaims]:
        try:
            claims = decode_access_token(token)
        except InvalidTokenError as exc:
            raise NotAuthenticatedError() from exc

        if await self.blacklist.contains(claims.jti):
            raise NotAuthenticatedError()

        user = await self.users.get_by_id(claims.user_id)

        if user is None:
            raise NotAuthenticatedError()

        return user, claims

    async def logout(self, token: str) -> None:
        try:
            _, claims = await self.authenticate(token)

            await self.blacklist.add(
                jti=claims.jti,
                expires_at=claims.expires_at,
            )
            await self.session.commit()

        except IntegrityError as exc:
            await self.session.rollback()

            # 동일 토큰의 동시 로그아웃으로 인한 중복 등록을 처리합니다.
            try:
                claims = decode_access_token(token)
            except InvalidTokenError as token_exc:
                raise NotAuthenticatedError() from token_exc

            if await self.blacklist.contains(claims.jti):
                raise NotAuthenticatedError() from exc

            raise

        except Exception:
            await self.session.rollback()
            raise