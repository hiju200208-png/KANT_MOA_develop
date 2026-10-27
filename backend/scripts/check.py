# [도구] push 전 로컬 검사: GitHub CI(backend job)와 같은 조건으로 백엔드 테스트를 돌린다
#
# 사용법 (backend 폴더에서, Docker Desktop이 켜져 있어야 한다):
#   uv run python scripts/check.py
#
# 하는 일 (CI와 같은 순서):
#   1) 쓰고 버리는 PostgreSQL 17 컨테이너를 띄운다 (내 로컬 DB·공용 DB는 건드리지 않는다)
#   2) alembic upgrade head로 DB를 만든다
#   3) pytest 전체 (마이그레이션 DB)
#   4) P2·P3 일회용 Docker DB 테스트
#   5) 성공·실패와 상관없이 컨테이너를 지운다
#
# CI와 같은 값을 쓰려고 backend/.env 대신 아래 테스트 전용 값을 넣는다. 실제 비밀값이 아니다.
import os
import subprocess
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
CONTAINER = f"kant-check-{os.getpid()}"
DB_USER = DB_PASSWORD = DB_NAME = "ci"
JWT_SECRET = "ci-only-not-a-real-secret-0000000000000000000000000000"

# 로컬 DB를 쓰게 만드는 스위치는 CI에 없으므로 끈다 (CI와 결과가 달라지지 않게)
LOCAL_ONLY_SWITCHES = ("P1_RUN_LOCAL_DB_TESTS", "ADMIN_DB_TEST", "P2_RUN_POSTGRES_TESTS", "P3_RUN_POSTGRES_TESTS")


def docker(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["docker", *args], capture_output=True, text=True)


def start_db() -> int:
    if docker("info").returncode != 0:
        sys.exit("멈춤: Docker가 꺼져 있어요. Docker Desktop을 켠 뒤 다시 실행하세요.")
    started = docker("run", "--detach", "--name", CONTAINER, "--label", "kant.check=true",
                     "-e", f"POSTGRES_USER={DB_USER}", "-e", f"POSTGRES_PASSWORD={DB_PASSWORD}",
                     "-e", f"POSTGRES_DB={DB_NAME}", "-p", "127.0.0.1::5432", "postgres:17")
    if started.returncode != 0:
        sys.exit(f"멈춤: 검사용 DB 컨테이너를 띄우지 못했어요.\n{started.stderr}")
    for _ in range(60):
        if docker("exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", DB_USER, "-d", DB_NAME).returncode == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError("검사용 DB가 60초 안에 준비되지 않았어요.")
    # 비어 있는 포트를 Docker가 골랐으므로 실제 번호를 읽는다 (5432·5433을 쓰는 로컬 DB와 겹치지 않음)
    return int(docker("port", CONTAINER, "5432/tcp").stdout.strip().splitlines()[0].rsplit(":", 1)[1])


def run(title: str, args: list[str], env: dict[str, str]) -> bool:
    print(f"\n=== {title} ===", flush=True)
    return subprocess.run([sys.executable, "-m", *args], cwd=BACKEND, env=env).returncode == 0


def main() -> int:
    env = {k: v for k, v in os.environ.items() if k not in LOCAL_ONLY_SWITCHES}
    results: list[tuple[str, bool]] = []
    try:
        port = start_db()
        env |= {
            "DATABASE_URL": f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@127.0.0.1:{port}/{DB_NAME}",
            "JWT_SECRET": JWT_SECRET,
        }
        steps = [
            ("alembic upgrade head", ["alembic", "upgrade", "head"], env),
            ("pytest (마이그레이션 DB)", ["pytest", "-rs"], env),
        ]
        docker_tests = [p for p in ("tests/products", "tests/orders") if (BACKEND / p).is_dir()]
        if docker_tests:
            steps.append(("pytest (일회용 Docker DB)", ["pytest", "-rs", *docker_tests],
                          env | {"P2_RUN_POSTGRES_TESTS": "1", "P3_RUN_POSTGRES_TESTS": "1"}))
        for title, args, step_env in steps:
            ok = run(title, args, step_env)
            results.append((title, ok))
            if not ok:  # 앞 단계가 실패하면 뒤 단계 결과는 믿을 수 없으므로 멈춘다
                break
    finally:
        docker("rm", "--force", "--volumes", CONTAINER)

    print("\n=== 결과 ===")
    for title, ok in results:
        print(f"{'통과' if ok else '실패'}  {title}")
    passed = len(results) > 0 and all(ok for _, ok in results)
    print("모두 통과했어요. push해도 돼요." if passed else "실패한 단계가 있어요. 고친 뒤 다시 실행하세요.")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
