"""회원 정보 변경의 도메인 규칙·트랜잭션·HTTP 접근 경계를 검증합니다."""
import asyncio
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth.application.service import AuthService
from auth.application.exceptions import NotAuthenticatedError
from auth.domain.user import User
from auth.domain.exceptions import InvalidUserError
from auth.presentation.router import router
from auth.presentation.dependencies import get_current_user, CurrentUser
from core.errors import register_error_handlers
from database import get_session


def member():
    return User(uuid4(), 'profile@example.com', '원래 이름', '기존 해시', phone='010-1234-5678')


def test_domain_partial_update_clear_and_atomic_validation():
    user = member()
    original_identity = (user.id, user.email, user.password_hash, user.role, user.google_sub)
    assert user.update_profile({'nickname': '  새 이름  '}) == {'nickname': '새 이름'}
    assert user.phone == '010-1234-5678'
    user.update_profile({'phone': None})
    assert user.phone is None
    user.update_profile({'phone': ' 010 1234 5678 '})
    assert user.phone == '010 1234 5678'
    before = (user.nickname, user.phone)
    with pytest.raises(InvalidUserError):
        user.update_profile({'nickname': '저장되면 안 됨', 'phone': '잘못된 번호'})
    assert (user.nickname, user.phone) == before
    assert (user.id, user.email, user.password_hash, user.role, user.google_sub) == original_identity


@pytest.mark.parametrize('changes', [{}, {'nickname': None}, {'nickname': ' '}, {'nickname': '가'*51},
                                     {'phone': 'abc01012345678'}, {'phone': 123}, {'role': 'ADMIN'}, {'user_id': '다른 회원'}])
def test_domain_rejects_invalid_changes(changes):
    with pytest.raises(InvalidUserError):
        member().update_profile(changes)


def test_service_commit_and_rollback():
    async def scenario():
        session = AsyncMock()
        service = AuthService(session)
        service.users = AsyncMock()
        user = member()
        service.users.get_by_id.return_value = user
        service.users.update_profile.return_value = user
        await service.update_profile(user.id, {'nickname': '새 이름'})
        service.users.update_profile.assert_awaited_once_with(user.id, {'nickname': '새 이름'})
        session.commit.assert_awaited_once()
        service.users.update_profile.side_effect = RuntimeError('저장 실패')
        with pytest.raises(RuntimeError):
            await service.update_profile(user.id, {'phone': None})
        session.rollback.assert_awaited_once()
        service.users.get_by_id.return_value = None
        with pytest.raises(NotAuthenticatedError):
            await service.update_profile(user.id, {'nickname': '회원 없음'})
    asyncio.run(scenario())


def test_http_requires_auth_and_uses_only_authenticated_user(monkeypatch):
    app = FastAPI()
    app.include_router(router)
    register_error_handlers(app)
    async def session():
        yield AsyncMock()
    app.dependency_overrides[get_session] = session
    client = TestClient(app)
    denied = client.patch('/auth/me', json={'nickname': '변경'})
    assert denied.status_code == 401 and denied.json()['code'] == 'NOT_AUTHENTICATED'
    user = member()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=user.id,email=user.email,nickname=user.nickname,role='USER',phone=user.phone)
    update = AsyncMock(return_value=user)
    monkeypatch.setattr('auth.presentation.router.AuthService.update_profile', update)
    response = client.patch('/auth/me', json={'phone': None})
    assert response.status_code == 200
    update.assert_awaited_once_with(user.id, {'phone': None})
    assert set(response.json()) == {'id','email','nickname','role','phone'}
    for payload in [{'role':'ADMIN'}, {'id':str(uuid4())}, {'user_id':str(uuid4())}, {'email':'other@example.com'},
                    {'password_hash':'new'}, {'google_sub':'new'}, {'nickname':None}, {'nickname':' '}]:
        invalid = client.patch('/auth/me', json=payload)
        assert invalid.status_code == 422 and set(invalid.json()) == {'code','message'}
