from typing import Annotated

from fastapi import APIRouter, Depends, Response, Request
from secrets import token_urlsafe, compare_digest

from auth.application.google_login import GoogleLoginService, GoogleAccountConflict
from auth.infrastructure.google_verifier import GoogleTokenVerifier
from auth.presentation.schemas import GoogleLoginRequest
from core.config import get_settings
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

GOOGLE_NONCE_COOKIE = "kantmoa_google_nonce"


def get_google_verifier():
    return GoogleTokenVerifier(get_settings().google_client_id)


@router.get("/google/config")
async def google_config(response: Response):
    settings = get_settings()
    response.headers["Cache-Control"] = "no-store"
    if not settings.google_client_id:
        return {"client_id": None, "nonce": None}
    nonce = token_urlsafe(32)
    response.set_cookie(GOOGLE_NONCE_COOKIE, nonce, max_age=300, httponly=True,
                        secure=settings.google_cookie_secure, samesite="lax", path="/")
    return {"client_id": settings.google_client_id, "nonce": nonce}


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleLoginRequest, request: Request, response: Response,
                       session: SessionDep, verifier=Depends(get_google_verifier)):
    if not get_settings().google_client_id:
        raise ApiError(409, "UNKNOWN", "Google 로그인 설정이 아직 준비되지 않았어요.")
    nonce = request.cookies.get(GOOGLE_NONCE_COOKIE)
    if not nonce or not compare_digest(nonce, body.nonce):
        raise ApiError(401, "NOT_AUTHENTICATED", "로그인 화면을 새로고침하고 다시 시도해주세요.")
    try:
        token = await GoogleLoginService(session, verifier).login(body.credential, nonce)
    except GoogleAccountConflict as exc:
        raise ApiError(409, exc.code, exc.message) from exc
    except InvalidCredentialsError as exc:
        raise ApiError(401, exc.code, "Google 인증 정보를 확인할 수 없어요.") from exc
    response.delete_cookie(GOOGLE_NONCE_COOKIE, path="/", secure=get_settings().google_cookie_secure,
                           httponly=True, samesite="lax")
    return TokenResponse(access_token=token.value, expires_in=token.expires_in)


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
