"""일회용 Docker DB에서 Google 신규 가입·재로그인·이메일 충돌을 검증합니다."""
import asyncio
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from auth.application.google_login import GoogleLoginService, GoogleAccountConflict
from auth.domain.google_identity import GoogleIdentity
from auth.infrastructure.models import UserModel
from auth.infrastructure.security import decode_access_token


def test_google_signup_and_existing_account_preservation(postgres_url):
    async def scenario():
        engine = create_async_engine(postgres_url, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        sub = 'google-test-' + uuid4().hex
        email = uuid4().hex + '@example.com'
        conflict_email = uuid4().hex + '@example.com'
        verifier = AsyncMock()
        verifier.verify.return_value = GoogleIdentity(sub, email, '구글 테스트')
        try:
            async with engine.begin() as conn:
                # 이 fixture가 만든 일회용 DB에만 인증 테이블을 준비합니다.
                await conn.run_sync(lambda sync: UserModel.__table__.create(sync, checkfirst=True))
            async with factory() as session:
                first = await GoogleLoginService(session, verifier).login('가짜 토큰', 'n' * 32)
            user_id = decode_access_token(first.value).user_id
            async with factory() as session:
                saved = await session.get(UserModel, user_id)
                assert saved.role == 'USER' and saved.google_sub == sub and saved.password_hash is None
                second = await GoogleLoginService(session, verifier).login('가짜 토큰', 'n' * 32)
                assert decode_access_token(second.value).user_id == user_id
                admin_id = uuid4()
                session.add(UserModel(id=admin_id, email=conflict_email, nickname='기존 관리자', role='ADMIN', password_hash='기존 해시'))
                await session.commit()
            verifier.verify.return_value = GoogleIdentity('different-' + sub, conflict_email, '충돌')
            async with factory() as session:
                with pytest.raises(GoogleAccountConflict):
                    await GoogleLoginService(session, verifier).login('가짜 토큰', 'n' * 32)
            async with factory() as session:
                saved = await session.get(UserModel, admin_id)
                assert saved.role == 'ADMIN' and saved.google_sub is None and saved.password_hash == '기존 해시'
        finally:
            async with engine.begin() as conn:
                await conn.execute(text('DELETE FROM users WHERE email IN (:one,:two)'), {'one': email, 'two': conflict_email})
            await engine.dispose()
    asyncio.run(scenario())
