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