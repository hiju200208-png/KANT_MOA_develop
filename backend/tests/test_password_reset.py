import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest

from auth.application.exceptions import InvalidResetTokenError
from auth.application.service import AuthService
from auth.domain.user import User
from auth.infrastructure.security import (
    InvalidTokenError,
    create_access_token,
    create_password_reset_token,
    decode_access_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from core.config import get_settings


@pytest.fixture(autouse=True)
def jwt_settings(monkeypatch):
    # 실제 .env 값 대신 테스트 전용 값을 사용합니다.
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/test")
    monkeypatch.setenv("JWT_SECRET", "test-only-secret-" + "a" * 48)
    monkeypatch.setenv("JWT_ISSUER", "kant-moa-test")
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


class FakeSession:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


class FakeUsers:
    def __init__(self, user):
        self.user = user

    async def get_by_email(self, email):
        return self.user if self.user and self.user.email == email else None

    async def get_by_id(self, user_id):
        return self.user if self.user and self.user.id == user_id else None

    async def update_password_hash(self, user_id, password_hash):
        self.user.password_hash = password_hash


def make_service(user):
    service = AuthService(FakeSession())
    service.users = FakeUsers(user)
    return service


def make_user(password="Old-password-1!"):
    return User(
        id=uuid4(),
        email="reset@example.com",
        nickname="재설정",
        password_hash=hash_password(password),
    )


def run(coro):
    return asyncio.run(coro)


def test_request_returns_token_only_for_password_account():
    user = make_user()
    service = make_service(user)

    assert run(service.request_password_reset(user.email))
    assert run(service.request_password_reset("nobody@example.com")) is None

    user.password_hash = None  # 구글 전용 계정
    assert run(service.request_password_reset(user.email)) is None


def test_confirm_changes_password_and_token_is_single_use():
    user = make_user()
    service = make_service(user)
    token = run(service.request_password_reset(user.email))

    run(service.confirm_password_reset(token, "New-password-2!"))

    assert verify_password("New-password-2!", user.password_hash)
    assert not verify_password("Old-password-1!", user.password_hash)
    assert service.session.commits == 1

    # 같은 링크는 다시 쓸 수 없습니다.
    with pytest.raises(InvalidResetTokenError):
        run(service.confirm_password_reset(token, "Another-pass-3!"))
    assert service.session.rollbacks == 1


def test_confirm_rejects_garbage_and_missing_user():
    user = make_user()
    service = make_service(user)

    with pytest.raises(InvalidResetTokenError):
        run(service.confirm_password_reset("not-a-token", "New-password-2!"))

    token = create_password_reset_token(uuid4(), user.password_hash)
    with pytest.raises(InvalidResetTokenError):
        run(service.confirm_password_reset(token, "New-password-2!"))


def test_reset_token_cannot_be_used_as_login_token():
    token = create_password_reset_token(uuid4(), "hash")

    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_access_token_cannot_be_used_as_reset_token():
    token = create_access_token(uuid4())

    with pytest.raises(InvalidTokenError):
        decode_password_reset_token(token.value)


def test_reset_token_expires(jwt_settings):
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "purpose": "password-reset",
            "fp": "x",
            "iat": now - timedelta(minutes=30),
            "exp": now - timedelta(minutes=15),
            "iss": jwt_settings.jwt_issuer,
        },
        jwt_settings.jwt_secret,
        algorithm=jwt_settings.jwt_algorithm,
    )

    with pytest.raises(InvalidTokenError):
        decode_password_reset_token(token)
