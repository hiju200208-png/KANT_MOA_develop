from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.domain.user import User
from auth.infrastructure.models import TokenBlacklistModel, UserModel


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _to_domain(model: UserModel) -> User:
        return User(
            id=model.id,
            email=model.email,
            nickname=model.nickname,
            password_hash=model.password_hash,
            google_sub=model.google_sub,
            phone=model.phone,
            role=model.role,
        )

    async def get_by_id(self, user_id: UUID) -> User | None:
        model = await self.session.get(UserModel, user_id)
        return self._to_domain(model) if model is not None else None

    async def get_by_email(self, email: str) -> User | None:
        normalized_email = email.strip().lower()

        result = await self.session.execute(
            select(UserModel).where(UserModel.email == normalized_email)
        )
        model = result.scalar_one_or_none()

        return self._to_domain(model) if model is not None else None

    async def add(self, user: User) -> User:
        model = UserModel(
            id=user.id,
            email=user.email,
            nickname=user.nickname,
            password_hash=user.password_hash,
            google_sub=user.google_sub,
            phone=user.phone,
            role=user.role.value,
        )

        self.session.add(model)
        await self.session.flush()

        return self._to_domain(model)

    async def update_password_hash(self, user_id: UUID, password_hash: str) -> None:
        model = await self.session.get(UserModel, user_id)

        if model is not None:
            model.password_hash = password_hash
            await self.session.flush()

    async def get_by_google_sub(self, sub: str) -> User | None:
        result = await self.session.execute(select(UserModel).where(UserModel.google_sub == sub))
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model is not None else None


class TokenBlacklistRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def contains(self, jti: str) -> bool:
        result = await self.session.execute(
            select(TokenBlacklistModel.jti).where(
                TokenBlacklistModel.jti == jti
            )
        )
        return result.scalar_one_or_none() is not None

    async def add(self, jti: str, expires_at: datetime) -> None:
        self.session.add(
            TokenBlacklistModel(
                jti=jti,
                expires_at=expires_at,
            )
        )
        await self.session.flush()
