from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.security import OAuth2PasswordRequestForm

from auth.application.exceptions import (
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    NotAuthenticatedError,
)
from auth.application.service import AuthService
from auth.domain.exceptions import InvalidUserError
from auth.presentation.dependencies import (
    CurrentUser,
    SessionDep,
    get_current_user,
    oauth2_scheme,
)
from auth.presentation.schemas import (
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from core.errors import ApiError


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=201,
)
async def signup(
    body: SignupRequest,
    session: SessionDep,
) -> UserResponse:
    try:
        user = await AuthService(session).signup(
            email=str(body.email),
            nickname=body.nickname,
            password=body.password,
        )
    except EmailAlreadyExistsError as exc:
        raise ApiError(409, exc.code, exc.message) from exc
    except InvalidUserError as exc:
        raise ApiError(422, "UNKNOWN", str(exc)) from exc

    return UserResponse(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        role=user.role.value,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
) -> TokenResponse:
    try:
        token = await AuthService(session).login(
            email=form.username,
            password=form.password,
        )
    except InvalidCredentialsError as exc:
        raise ApiError(401, exc.code, exc.message) from exc

    return TokenResponse(
        access_token=token.value,
        expires_in=token.expires_in,
    )


@router.get("/me", response_model=UserResponse)
async def me(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        role=user.role,
    )


@router.post("/logout", status_code=204)
async def logout(
    session: SessionDep,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> Response:
    if not token:
        raise ApiError(
            401,
            "NOT_AUTHENTICATED",
            "로그인이 필요해요.",
        )

    try:
        await AuthService(session).logout(token)
    except NotAuthenticatedError as exc:
        raise ApiError(401, exc.code, exc.message) from exc

    return Response(status_code=204)