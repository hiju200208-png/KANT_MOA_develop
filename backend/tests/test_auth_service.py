import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import delete

from auth.application.exceptions import (
    EmailAlreadyExistsError,
    InvalidCredentialsError,
)
from auth.application.service import AuthService
from auth.infrastructure.models import UserModel
from auth.infrastructure.security import (
    decode_access_token,
    verify_password,
)
from database import engine, session_factory


def test_signup_login_and_failures():
    async def scenario():
        email = f"auth-test-{uuid4().hex}@example.com"
        password = "Test-password-123!"

        try:
            async with session_factory() as session:
                service = AuthService(session)

                # 가입 성공과 비밀번호 해싱 확인
                user = await service.signup(
                    email=email,
                    nickname="인증 테스트",
                    password=password,
                )

                assert user.email == email
                assert user.password_hash != password
                assert verify_password(password, user.password_hash)

                # 로그인 성공과 JWT의 회원 ID 확인
                token = await service.login(email, password)
                assert decode_access_token(token.value).user_id == user.id

                # 중복 가입 거부
                with pytest.raises(EmailAlreadyExistsError):
                    await service.signup(
                        email=email,
                        nickname="중복 테스트",
                        password=password,
                    )

                # 잘못된 비밀번호 거부
                with pytest.raises(InvalidCredentialsError):
                    await service.login(email, "wrong-password")

                # 없는 회원 로그인 거부
                with pytest.raises(InvalidCredentialsError):
                    await service.login(
                        f"missing-{uuid4().hex}@example.com",
                        password,
                    )

            # 별도 세션에서도 회원이 조회돼야 commit 성공
            async with session_factory() as session:
                service = AuthService(session)
                saved = await service.users.get_by_email(email)
                assert saved is not None
                assert saved.id == user.id

        finally:
            # 이 테스트가 생성한 고유 이메일의 회원만 정리합니다.
            try:
                async with session_factory() as session:
                    await session.execute(
                        delete(UserModel).where(UserModel.email == email)
                    )
                    await session.commit()
            finally:
                await engine.dispose()

    asyncio.run(scenario())