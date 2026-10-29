from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.application.exceptions import NotAuthenticatedError
from auth.application.service import AuthService
from core.errors import ApiError
from database import get_session


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/login",
    auto_error=False,
)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class CurrentUser(BaseModel):
    id: UUID
    email: str
    nickname: str
    role: str
    phone: str | None = None


async def get_current_user(
    session: SessionDep,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> CurrentUser:
    if not token:
        raise ApiError(
            401,
            "NOT_AUTHENTICATED",
            "로그인이 필요해요.",
        )

    try:
        user, _ = await AuthService(session).authenticate(token)
    except NotAuthenticatedError as exc:
        raise ApiError(401, exc.code, exc.message) from exc

    return CurrentUser(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        role=user.role.value,
        phone=user.phone,
    )


async def require_admin(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if user.role != "ADMIN":
        raise ApiError(
            403,
            "UNKNOWN",
            "접근 권한이 없어요.",
        )

    return user
