"""일회용 PostgreSQL·실제 JWT로 본인 수정과 실패 시 데이터 보존을 검증합니다."""
import asyncio
from uuid import uuid4
from unittest.mock import patch

import httpx
from fastapi import FastAPI
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from auth.domain.user import User
from auth.infrastructure.models import UserModel, TokenBlacklistModel
from auth.infrastructure.repositories import UserRepository
from auth.infrastructure.security import create_access_token, decode_access_token
from auth.presentation.router import router
from core.errors import register_error_handlers
from database import get_session


def test_profile_save_reload_partial_clear_authorization_and_rollback(postgres_url):
    async def scenario():
        engine = create_async_engine(postgres_url, poolclass=NullPool)
        factory = async_sessionmaker(engine,expire_on_commit=False)
        app = FastAPI()
        app.include_router(router)
        register_error_handlers(app)
        async def session():
            async with factory() as value:
                try:
                    yield value
                finally:
                    if value.in_transaction():
                        await value.rollback()
        app.dependency_overrides[get_session] = session
        ids = [uuid4(),uuid4()]
        token = create_access_token(ids[0]).value
        other_token = create_access_token(ids[1]).value
        headers = {'Authorization':'Bearer '+token}
        async def state():
            async with factory() as s:
                rows = (await s.execute(select(UserModel).where(UserModel.id.in_(ids)).order_by(UserModel.email))).scalars().all()
                return {u.id:(u.email,u.nickname,u.phone,u.role,u.password_hash,u.google_sub) for u in rows}
        try:
            async with factory() as s:
                s.add_all([
                    UserModel(id=ids[0],email=uuid4().hex+'@example.com',nickname='구글 회원',google_sub=uuid4().hex,role='USER'),
                    UserModel(id=ids[1],email=uuid4().hex+'@example.com',nickname='다른 관리자',password_hash='기존 해시',role='ADMIN'),
                ])
                await s.commit()
            original = await state()
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app,raise_app_exceptions=False),base_url='http://test') as client:
                assert (await client.patch('/auth/me',json={'nickname':'무인증'})).status_code == 401
                assert (await client.patch('/auth/me',headers={'Authorization':'Bearer invalid'},json={'nickname':'위조'})).status_code == 401
                changed = await client.patch('/auth/me',headers=headers,json={'nickname':'  수정 회원  ','phone':'010-1234-5678'})
                assert changed.status_code == 200 and changed.json()['nickname'] == '수정 회원'
                assert changed.json()['phone'] == '010-1234-5678'
                restored = await client.get('/auth/me',headers=headers)
                assert restored.json() == changed.json()
                assert (await state())[ids[1]] == original[ids[1]]
                partial = await client.patch('/auth/me',headers=headers,json={'nickname':'이름만 변경'})
                assert partial.status_code == 200 and partial.json()['phone'] == '010-1234-5678'
                before_failure = await state()
                for payload in [{}, {'nickname':'다른 이름','phone':'bad'}, {'nickname':None}, {'role':'ADMIN'}, {'user_id':str(ids[1])}]:
                    result = await client.patch('/auth/me',headers=headers,json=payload)
                    assert result.status_code == 422
                    assert await state() == before_failure
                # DB에 실제 UPDATE가 실행된 뒤 실패해도 Application rollback으로 보존됩니다.
                real_update = UserRepository.update_profile
                async def fail_after_update(repo, user_id, changes):
                    await real_update(repo,user_id,changes)
                    raise RuntimeError('테스트 저장 후 실패')
                with patch.object(UserRepository,'update_profile',fail_after_update):
                    assert (await client.patch('/auth/me',headers=headers,json={'nickname':'롤백 대상'})).status_code == 500
                assert await state() == before_failure
                cleared = await client.patch('/auth/me',headers=headers,json={'phone':None})
                assert cleared.status_code == 200 and cleared.json()['phone'] is None
                assert (await client.get('/auth/me',headers=headers)).json()['phone'] is None
                admin = await client.patch('/auth/me',headers={'Authorization':'Bearer '+other_token},json={'nickname':'관리자 본인 수정'})
                assert admin.status_code == 200 and admin.json()['role'] == 'ADMIN'
                assert (await client.post('/auth/logout',headers=headers)).status_code == 204
                final = await state()
                assert (await client.patch('/auth/me',headers=headers,json={'nickname':'로그아웃 토큰'})).status_code == 401
                assert await state() == final
                for uid in ids:
                    assert final[uid][0] == original[uid][0]
                    assert final[uid][3:] == original[uid][3:]
        finally:
            async with factory() as s:
                await s.execute(delete(TokenBlacklistModel).where(TokenBlacklistModel.jti.in_([decode_access_token(token).jti,decode_access_token(other_token).jti])))
                await s.execute(delete(UserModel).where(UserModel.id.in_(ids)))
                await s.commit()
            await engine.dispose()
    asyncio.run(scenario())
