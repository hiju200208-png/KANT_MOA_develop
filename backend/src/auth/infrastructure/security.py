import hashlib
import hmac
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt
from pwdlib import PasswordHash

from core.config import get_settings


password_hasher = PasswordHash.recommended()


class InvalidTokenError(ValueError):
    """JWT 서명·만료·필수 정보가 유효하지 않을 때 발생합니다."""


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


@dataclass(frozen=True)
class AccessToken:
    value: str
    expires_in: int


@dataclass(frozen=True)
class TokenClaims:
    user_id: UUID
    jti: str
    expires_at: datetime


def create_access_token(user_id: UUID) -> AccessToken:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(
        minutes=settings.jwt_expire_minutes
    )

    payload = {
        "sub": str(user_id),
        "jti": str(uuid4()),
        "iat": now,
        "exp": expires_at,
        "iss": settings.jwt_issuer,
    }

    value = jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    return AccessToken(
        value=value,
        expires_in=settings.jwt_expire_minutes * 60,
    )


def decode_access_token(token: str) -> TokenClaims:
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={
                "require": ["sub", "jti", "iat", "exp", "iss"],
            },
        )

        user_id = UUID(payload["sub"])
        jti = payload["jti"]

        if not isinstance(jti, str) or not jti.strip():
            raise InvalidTokenError("유효하지 않은 토큰입니다.")

        expires_at = datetime.fromtimestamp(
            payload["exp"],
            tz=timezone.utc,
        )

        return TokenClaims(
            user_id=user_id,
            jti=jti,
            expires_at=expires_at,
        )

    except (jwt.InvalidTokenError, ValueError, TypeError, OverflowError) as exc:
        raise InvalidTokenError("유효하지 않은 토큰입니다.") from exc


# ---- 비밀번호 재설정 토큰 -------------------------------------------------
# 로그인 토큰과 섞이지 않도록 jti 없이 purpose 값을 따로 둡니다.
# (decode_access_token은 jti를 요구하므로 재설정 토큰은 로그인에 쓸 수 없습니다.)
PASSWORD_RESET_PURPOSE = "password-reset"


@dataclass(frozen=True)
class PasswordResetClaims:
    user_id: UUID
    fingerprint: str


def password_fingerprint(password_hash: str) -> str:
    """현재 비밀번호 해시의 지문. 비밀번호가 바뀌면 달라져 토큰이 1회용이 됩니다."""
    settings = get_settings()
    return hmac.new(
        settings.jwt_secret.encode(),
        password_hash.encode(),
        hashlib.sha256,
    ).hexdigest()[:24]


def create_password_reset_token(user_id: UUID, password_hash: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "purpose": PASSWORD_RESET_PURPOSE,
        "fp": password_fingerprint(password_hash),
        "iat": now,
        "exp": now + timedelta(minutes=settings.password_reset_expire_minutes),
        "iss": settings.jwt_issuer,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_password_reset_token(token: str) -> PasswordResetClaims:
    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "purpose", "fp", "iat", "exp", "iss"]},
        )

        if payload["purpose"] != PASSWORD_RESET_PURPOSE:
            raise InvalidTokenError("유효하지 않은 토큰입니다.")

        fingerprint = payload["fp"]

        if not isinstance(fingerprint, str) or not fingerprint:
            raise InvalidTokenError("유효하지 않은 토큰입니다.")

        return PasswordResetClaims(
            user_id=UUID(payload["sub"]),
            fingerprint=fingerprint,
        )

    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise InvalidTokenError("유효하지 않은 토큰입니다.") from exc
