import asyncio
from uuid import uuid4

from auth.domain.user import User
from auth.infrastructure.repositories import UserRepository
from database import engine, session_factory


def test_user_repository_save_read_and_rollback():
    async def scenario():
        email = f"repo-test-{uuid4().hex}@example.com"
        user = User.register(
            email=email,
            nickname="Repository 테스트",
            password_hash="test-hash",
        )

        try:
            async with session_factory() as session:
                repository = UserRepository(session)

                try:
                    saved = await repository.add(user)
                    found_by_id = await repository.get_by_id(user.id)
                    found_by_email = await repository.get_by_email(
                        f"  {email.upper()}  "
                    )

                    assert isinstance(saved, User)
                    assert found_by_id is not None
                    assert found_by_email is not None
                    assert found_by_id.id == user.id
                    assert found_by_email.id == user.id
                    assert found_by_email.nickname == "Repository 테스트"
                finally:
                    await session.rollback()

            # 다른 세션에서 조회해도 데이터가 없어야 합니다.
            async with session_factory() as session:
                repository = UserRepository(session)
                assert await repository.get_by_id(user.id) is None
        finally:
            await engine.dispose()

    asyncio.run(scenario())