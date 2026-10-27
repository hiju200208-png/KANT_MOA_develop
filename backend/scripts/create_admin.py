import asyncio
import sys
from getpass import getpass
from pathlib import Path

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.exc import SQLAlchemyError

# 실행 위치와 관계없이 backend/src의 모듈을 찾습니다.
sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "src"),
)

from auth.application.exceptions import EmailAlreadyExistsError
from auth.application.service import AuthService
from auth.domain.exceptions import InvalidUserError
from database import engine, session_factory


async def create_admin(
    email: str,
    nickname: str,
    password: str,
) -> int:
    try:
        async with session_factory() as session:
            user = await AuthService(session).create_admin(
                email=email,
                nickname=nickname,
                password=password,
            )

        print(f"관리자 생성 완료: id={user.id}, role={user.role.value}")
        return 0

    except EmailAlreadyExistsError:
        print("이미 가입된 이메일입니다. 기존 계정은 변경하지 않았습니다.")
        return 1

    except (InvalidUserError, ValueError):
        print("입력값을 확인해주세요. 관리자 생성에 실패했습니다.")
        return 1

    except SQLAlchemyError:
        print("DB 처리에 실패했습니다. 연결 및 테이블 상태를 확인해주세요.")
        return 1

    finally:
        await engine.dispose()


def main() -> int:
    print("관리자 계정 생성")
    print("현재 backend/.env가 가리키는 DB에 저장됩니다.")
    print("지금은 로컬 Docker DB에 연결됐는지 먼저 확인해주세요.")

    try:
        email = input("이메일: ").strip().lower()
        nickname = input("닉네임: ").strip()

        try:
            email = str(TypeAdapter(EmailStr).validate_python(email))
        except ValidationError:
            print("올바른 이메일 형식이 아닙니다.")
            return 1

        if not 1 <= len(nickname) <= 50:
            print("닉네임은 1~50자여야 합니다.")
            return 1

        password = getpass("비밀번호: ")
        confirmation = getpass("비밀번호 확인: ")

        if password != confirmation:
            print("비밀번호가 일치하지 않습니다.")
            return 1

        if not 8 <= len(password) <= 128:
            print("비밀번호는 8~128자여야 합니다.")
            return 1

        return asyncio.run(create_admin(email, nickname, password))

    except (KeyboardInterrupt, EOFError):
        print("\n취소했습니다.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())