from uuid import UUID

import pytest

from auth.domain.exceptions import InvalidUserError
from auth.domain.user import User, UserRole


def test_register_normalizes_email_and_creates_user():
    user = User.register(
        email="  Heeju@Example.com  ",
        nickname="  희주  ",
        password_hash="test-hash",
    )

    assert user.email == "heeju@example.com"
    assert user.nickname == "희주"
    assert isinstance(user.id, UUID)
    assert user.id.version == 4
    assert user.role == UserRole.USER
    assert not user.is_admin()


@pytest.mark.parametrize(
    ("email", "nickname", "password_hash"),
    [
        ("   ", "희주", "test-hash"),
        ("heeju@example.com", "   ", "test-hash"),
        ("heeju@example.com", "희주", ""),
    ],
)
def test_register_rejects_invalid_values(email, nickname, password_hash):
    with pytest.raises(InvalidUserError):
        User.register(email, nickname, password_hash)


def test_google_user_can_exist_without_password():
    user = User(
        id=UUID("00000000-0000-4000-8000-000000000001"),
        email="heeju@example.com",
        nickname="희주",
        password_hash=None,
        google_sub="google-test-subject",
    )

    assert user.password_hash is None
    assert user.google_sub == "google-test-subject"


def test_user_requires_at_least_one_login_method():
    with pytest.raises(InvalidUserError):
        User(
            id=UUID("00000000-0000-4000-8000-000000000001"),
            email="heeju@example.com",
            nickname="희주",
            password_hash=None,
            google_sub=None,
        )


def test_user_rejects_unknown_role():
    with pytest.raises(InvalidUserError):
        User(
            id=UUID("00000000-0000-4000-8000-000000000001"),
            email="heeju@example.com",
            nickname="희주",
            password_hash="test-hash",
            role="SUPERADMIN",
        )