"""공용 DB·실제 Google 계정 없이 인증 경계와 가입 정책을 검증합니다."""
import asyncio
import json
import time
from unittest.mock import AsyncMock
from uuid import uuid4

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from auth.application.exceptions import InvalidCredentialsError
from auth.application.google_login import GoogleAccountConflict, GoogleLoginService
from auth.domain.google_identity import GoogleIdentity
from auth.domain.user import User, UserRole
from auth.infrastructure.google_verifier import GoogleTokenVerifier
from auth.infrastructure.security import AccessToken
from auth.presentation.router import router, get_google_verifier, GOOGLE_NONCE_COOKIE
from core.config import get_settings
from core.errors import register_error_handlers
from database import get_session


def test_google_new_user_and_returning_subject(monkeypatch):
    async def scenario():
        session = AsyncMock()
        verifier = AsyncMock()
        verifier.verify.return_value = GoogleIdentity('subject-1', 'google@example.com', '구글회원')
        service = GoogleLoginService(session, verifier)
        service.users = AsyncMock()
        service.users.get_by_google_sub.return_value = None
        service.users.get_by_email.return_value = None
        service.users.add.side_effect = lambda user: user
        monkeypatch.setattr('auth.application.google_login.create_access_token', lambda uid: AccessToken(str(uid), 1800))
        token = await service.login('검증대상', 'n' * 32)
        user = service.users.add.call_args.args[0]
        assert user.role == UserRole.USER
        assert user.password_hash is None and user.google_sub == 'subject-1'
        assert token.value == str(user.id)
        session.commit.assert_awaited_once()
        # Google 이메일이 변경돼도 sub로 기존 계정·권한을 찾습니다.
        service.users.get_by_google_sub.return_value = user
        service.users.add.reset_mock()
        await service.login('검증대상', 'n' * 32)
        service.users.add.assert_not_awaited()
    asyncio.run(scenario())


def test_existing_email_is_never_automatically_linked():
    async def scenario():
        session = AsyncMock()
        verifier = AsyncMock()
        verifier.verify.return_value = GoogleIdentity('new-subject', 'admin@example.com', '이름')
        service = GoogleLoginService(session, verifier)
        service.users = AsyncMock()
        service.users.get_by_google_sub.return_value = None
        service.users.get_by_email.return_value = User(uuid4(), 'admin@example.com', '관리자', '기존 해시', role=UserRole.ADMIN)
        with pytest.raises(GoogleAccountConflict):
            await service.login('토큰', 'n' * 32)
        service.users.add.assert_not_awaited()
        session.commit.assert_not_awaited()
        session.rollback.assert_awaited_once()
    asyncio.run(scenario())


def test_racing_google_signup_rolls_back_before_subject_lookup(monkeypatch):
    async def scenario():
        session = AsyncMock()
        verifier = AsyncMock()
        verifier.verify.return_value = GoogleIdentity('subject', 'g@example.com', '회원')
        service = GoogleLoginService(session, verifier)
        service.users = AsyncMock()
        user = User(uuid4(), 'g@example.com', '회원', None, google_sub='subject')
        service.users.get_by_google_sub.side_effect = [None, user]
        service.users.get_by_email.return_value = None
        service.users.add.side_effect = IntegrityError('삽입', {}, Exception())
        monkeypatch.setattr('auth.application.google_login.create_access_token', lambda uid: AccessToken(str(uid), 1800))
        assert (await service.login('토큰', 'n' * 32)).value == str(user.id)
        session.rollback.assert_awaited_once()
        session.commit.assert_not_awaited()
    asyncio.run(scenario())


@pytest.mark.parametrize('change', [
    {'email_verified': False}, {'nonce': '다른 nonce'}, {'nonce': None},
    {'sub': ''}, {'email': None},
])
def test_verifier_rejects_invalid_claims(monkeypatch, change):
    claims = {'sub': 'subject', 'email': 'google@example.com', 'email_verified': True, 'nonce': 'n' * 32}
    claims.update(change)
    monkeypatch.setattr('auth.infrastructure.google_verifier.id_token.verify_oauth2_token', lambda *a, **kw: claims)
    with pytest.raises(InvalidCredentialsError):
        asyncio.run(GoogleTokenVerifier('client-id').verify('token', 'n' * 32))


def test_verifier_passes_audience_and_rejects_signature_failure(monkeypatch):
    def verified(credential, transport, audience):
        assert audience == 'expected-client'
        return {'sub': 'subject', 'email': ' GOOGLE@example.com ', 'email_verified': True, 'nonce': 'n' * 32}
    monkeypatch.setattr('auth.infrastructure.google_verifier.id_token.verify_oauth2_token', verified)
    identity = asyncio.run(GoogleTokenVerifier('expected-client').verify('token', 'n' * 32))
    assert identity.email == 'google@example.com'
    def rejected(*args, **kwargs):
        raise ValueError('토큰 원문을 포함할 수 있는 검증 실패')
    monkeypatch.setattr('auth.infrastructure.google_verifier.id_token.verify_oauth2_token', rejected)
    with pytest.raises(InvalidCredentialsError) as error:
        asyncio.run(GoogleTokenVerifier('expected-client').verify('token', 'n' * 32))
    assert '원문' not in str(error.value)


def test_google_http_nonce_and_team_errors(monkeypatch):
    monkeypatch.setenv('GOOGLE_CLIENT_ID', 'test-client')
    monkeypatch.setenv('GOOGLE_COOKIE_SECURE', 'true')
    get_settings.cache_clear()
    app = FastAPI()
    app.include_router(router)
    register_error_handlers(app)
    async def session():
        yield AsyncMock()
    app.dependency_overrides[get_session] = session
    app.dependency_overrides[get_google_verifier] = lambda: AsyncMock()
    login = AsyncMock(return_value=AccessToken('팀-jwt', 1800))
    monkeypatch.setattr('auth.presentation.router.GoogleLoginService.login', login)
    try:
        client = TestClient(app, base_url='https://testserver')
        assert client.post('/auth/google', json={'credential': '토큰', 'nonce': 'n' * 32}).status_code == 401
        config = client.get('/auth/google/config')
        assert config.headers['cache-control'] == 'no-store'
        assert 'HttpOnly' in config.headers['set-cookie'] and 'Secure' in config.headers['set-cookie']
        nonce = config.json()['nonce']
        assert client.post('/auth/google', json={'credential': '토큰', 'nonce': 'x' * 32}).status_code == 401
        assert client.post('/auth/google', json={'credential': '토큰', 'nonce': nonce, 'role': 'ADMIN'}).status_code == 422
        response = client.post('/auth/google', json={'credential': '토큰', 'nonce': nonce})
        assert response.status_code == 200 and response.json()['access_token'] == '팀-jwt'
        assert GOOGLE_NONCE_COOKIE not in client.cookies
        for exception, status in [(GoogleAccountConflict(), 409), (InvalidCredentialsError(), 401)]:
            nonce = client.get('/auth/google/config').json()['nonce']
            login.side_effect = exception
            response = client.post('/auth/google', json={'credential': '토큰', 'nonce': nonce})
            assert response.status_code == status
            assert set(response.json()) == {'code', 'message'}
        monkeypatch.setenv('GOOGLE_CLIENT_ID', '')
        get_settings.cache_clear()
        assert client.get('/auth/google/config').json() == {'client_id': None, 'nonce': None}
        assert client.post('/auth/google', json={'credential': '토큰', 'nonce': 'n' * 32}).status_code == 409
    finally:
        get_settings.cache_clear()


def test_official_verifier_with_real_signature_audience_issuer_and_expiry(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    class Certificates:
        status = 200
        data = json.dumps({'test-key': public}).encode()
    monkeypatch.setattr('auth.infrastructure.google_verifier.Request', lambda: lambda *a, **kw: Certificates())
    now = int(time.time())
    claims = {'sub': 'subject', 'email': 'g@example.com', 'email_verified': True, 'nonce': 'n' * 32,
              'iss': 'https://accounts.google.com', 'aud': 'client', 'iat': now, 'exp': now + 300}
    verifier = GoogleTokenVerifier('client')
    def token(values, signing_key=key):
        return jwt.encode(values, signing_key, algorithm='RS256', headers={'kid': 'test-key'})
    assert asyncio.run(verifier.verify(token(claims), 'n' * 32)).sub == 'subject'
    for change in ({'aud': 'other-client'}, {'iss': 'https://attacker.invalid'}, {'iat': now-500, 'exp': now-300}):
        with pytest.raises(InvalidCredentialsError):
            asyncio.run(verifier.verify(token({**claims, **change}), 'n' * 32))
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(InvalidCredentialsError):
        asyncio.run(verifier.verify(token(claims, wrong_key), 'n' * 32))
