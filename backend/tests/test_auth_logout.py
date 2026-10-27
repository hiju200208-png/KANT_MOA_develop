import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import delete

from auth.application.exceptions import NotAuthenticatedError
from auth.application.service import AuthService
from auth.infrastructure.models import TokenBlacklistModel, UserModel
from auth.infrastructure.security import decode_access_token
from database import engine, session_factory


def test_logout_blocks_token_across_sessions():
    async def scenario():
        email = f"logout-test-{uuid4().hex}@example.com"
        password = "Test-password-123!"
        jti = None

        try:
            # 회원가입·로그인·인증 성공
            async with session_factory() as session:
                service = AuthService(session)

                user = await service.signup(
                    email=email,
                    nickname="로그아웃 테스트",
                    password=password,
                )
                token = await service.login(email, password)
                jti = decode_access_token(token.value).jti

                authenticated, _ = await service.authenticate(token.value)
                assert authenticated.id == user.id

                # 로그아웃은 블랙리스트를 DB에 저장하고 commit합니다.
                await service.logout(token.value)

            # 새 세션에서도 차단돼야 합니다.
            async with session_factory() as session:
                service = AuthService(session)

                assert await service.blacklist.contains(jti)

                with pytest.raises(NotAuthenticatedError):
                    await service.authenticate(token.value)

                with pytest.raises(NotAuthenticatedError):
                    await service.logout(token.value)

        finally:
            # 이 테스트에서 만든 데이터만 정리합니다.
            try:
                async with session_factory() as session:
                    if jti is not None:
                        await session.execute(
                            delete(TokenBlacklistModel).where(
                                TokenBlacklistModel.jti == jti
                            )
                        )

                    await session.execute(
                        delete(UserModel).where(UserModel.email == email)
                    )
                    await session.commit()
            finally:
                await engine.dispose()

    asyncio.run(scenario())