from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest

from core.config import get_settings
from auth.infrastructure.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


@pytest.fixture
def jwt_settings(monkeypatch):
    # 실제 .env 비밀키 대신 테스트 전용 값을 사용합니다.
    monkeypatch.setenv("JWT_SECRET", "test-only-secret-" + "a" * 48)
    monkeypatch.setenv("JWT_ALGORITHM", "HS256")
    monkeypatch.setenv("JWT_EXPIRE_MINUTES", "30")
    monkeypatch.setenv("JWT_ISSUER", "kant-moa-test")
    get_settings.cache_clear()

    yield get_settings()

    get_settings.cache_clear()


def test_password_hash_and_verification():
    password = "Test-password-123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_token_round_trip(jwt_settings):
    user_id = uuid4()

    token = create_access_token(user_id)
    claims = decode_access_token(token.value)

    assert claims.user_id == user_id
    assert claims.jti
    assert claims.expires_at > datetime.now(timezone.utc)
    assert token.expires_in == 1800


def test_rejects_token_signed_with_another_key(jwt_settings):
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "jti": str(uuid4()),
            "iat": now,
            "exp": now + timedelta(minutes=30),
            "iss": jwt_settings.jwt_issuer,
        },
        "different-test-key-" + "b" * 48,
        algorithm="HS256",
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_rejects_expired_token(jwt_settings):
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "jti": str(uuid4()),
            "iat": now - timedelta(hours=1),
            "exp": now - timedelta(minutes=1),
            "iss": jwt_settings.jwt_issuer,
        },
        jwt_settings.jwt_secret,
        algorithm="HS256",
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_rejects_missing_required_claim(jwt_settings):
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid4()),
            # jti가 없는 토큰
            "iat": now,
            "exp": now + timedelta(minutes=30),
            "iss": jwt_settings.jwt_issuer,
        },
        jwt_settings.jwt_secret,
        algorithm="HS256",
    )

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)