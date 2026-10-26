import asyncio
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import create_async_engine

from auth.application.service import AuthService
from auth.infrastructure.models import UserModel
from auth.presentation.dependencies import CurrentUser, require_admin
from core.config import get_settings
from core.errors import register_error_handlers
from database import get_session, session_factory, engine


def test_admin_permission():
    suffix = uuid4().hex
    user_email = f"user-{suffix}@example.com"
    admin_email = f"admin-{suffix}@example.com"
    password = "Permission-test-123!"

    async def prepare():
        try:
            async with session_factory() as session:
                service = AuthService(session)

                await service.signup(user_email, "일반회원", password)
                await service.create_admin(admin_email, "관리자", password)

                user_token = await service.login(user_email, password)
                admin_token = await service.login(admin_email, password)

                return user_token.value, admin_token.value
        finally:
            await engine.dispose()

    async def cleanup():
        try:
            async with session_factory() as session:
                await session.execute(
                    delete(UserModel).where(
                        UserModel.email.in_([user_email, admin_email])
                    )
                )
                await session.commit()
        finally:
            await engine.dispose()

    app = FastAPI()
    register_error_handlers(app)

    @app.get("/admin-check")
    async def admin_check(
        user: Annotated[CurrentUser, Depends(require_admin)],
    ):
        return {"role": user.role}

    # TestClient의 이벤트 루프에서 사용할 별도 엔진입니다.
    from sqlalchemy.ext.asyncio import async_sessionmaker

    test_engine = create_async_engine(get_settings().database_url)
    test_sessions = async_sessionmaker(
        test_engine,
        expire_on_commit=False,
    )

    async def test_session():
        async with test_sessions() as session:
            try:
                yield session
            finally:
                await session.rollback()

        # 요청 사이에 다른 이벤트 루프의 연결을 재사용하지 않습니다.
        await test_engine.dispose()

    app.dependency_overrides[get_session] = test_session

    try:
        user_token, admin_token = asyncio.run(prepare())

        with TestClient(app) as client:
            missing = client.get("/admin-check")
            assert missing.status_code == 401

            denied = client.get(
                "/admin-check",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            assert denied.status_code == 403
            assert denied.json() == {
                "code": "UNKNOWN",
                "message": "접근 권한이 없어요.",
            }

            allowed = client.get(
                "/admin-check",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert allowed.status_code == 200
            assert allowed.json() == {"role": "ADMIN"}

    finally:
        app.dependency_overrides.clear()
        asyncio.run(cleanup())