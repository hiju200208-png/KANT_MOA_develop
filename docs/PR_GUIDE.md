# PR 가이드 · 2조 공통

> 4명 모두 PR을 만들고 머지할 수 있다. 그래서 "누가 확인했나"가 아니라 **GitHub가 검사를 강제**하고, 각자 PC에서도 **CI와 같은 조건**으로 미리 검사한다.
> 팀 규칙 원본은 `CLAUDE.md` · `docs/PROJECT2.md`. 충돌하면 그쪽을 따른다.

## 1. 처음 한 번만 (clone마다)

```bash
git config core.hooksPath .githooks
```

이후 commit·push 때 아래 검사가 자동으로 돈다.

| 시점 | 검사 | 실패하면 |
| --- | --- | --- |
| commit | `.env` 같은 비밀값 파일이 들어갔는지 | 커밋 멈춤 |
| push | `main`에 직접 push하는지 | push 멈춤 |
| push | `backend/`가 바뀌었으면 백엔드 검사 (`backend/scripts/check.py`) | push 멈춤 |
| push | 프론트 파일이 바뀌었으면 `npm run lint` · `typecheck` · `test` | push 멈춤 |

준비물: Docker Desktop 켜 두기, `backend`에서 `uv sync`, 루트에서 `npm ci`.

## 2. 매번 하는 순서

1. **내 브랜치에서 작업**: `main`에서 직접 작업하지 않는다.
2. **최신 main 받기**: `git fetch origin` → `git merge origin/main`. 충돌은 내 브랜치에서 푼다.
3. **add · commit**: 내 담당 폴더만. 공통 파일(`main.py` · `database.py` · `core/` · `compose.yaml` · `.github/`)은 P1(희주)과 협의한 경우만.
4. **로컬 검사** (push hook이 자동으로 돌리지만 미리 돌려 봐도 된다):
   ```bash
   cd backend
   uv run python scripts/check.py
   ```
   쓰고 버리는 PostgreSQL을 띄워 CI와 같은 순서로 검사하고, 끝나면 지운다. 내 로컬 DB·공용 DB는 건드리지 않는다.
5. **push**: `git push origin <내 브랜치>`
6. **PR 만들기**: base는 `main`. 템플릿 칸을 채운다.
7. **CI 확인**: PR 화면에서 `frontend`와 `backend`가 둘 다 초록색인지 본다. 빨간색이면 로그를 열어 고치고 다시 push한다.
8. **Swagger 확인**: `main.py`로 서버를 띄우고 실제 로그인 토큰으로 확인한다. PR 템플릿 표에 응답과 **DB 증거(전 → 후)**를 적는다. 토큰·비밀번호 값은 적지 않는다.
9. **리뷰 1명 승인 → 머지**: 본인 PR은 다른 사람이 승인한다.

## 3. 백엔드 검사가 하는 일

`backend/scripts/check.py`와 `.github/workflows/ci.yml`의 `backend` job은 같은 일을 한다.

1. PostgreSQL 17 임시 DB 준비
2. `alembic upgrade head` (마이그레이션 자체도 검증)
3. `pytest -rs` 전체
4. P2·P3 일회용 Docker DB 테스트 (`tests/products`, `tests/orders`)

- `DATABASE_URL` · `JWT_SECRET`은 **검사 전용 가짜 값**이다. `backend/.env`를 쓰지 않는다.
- 로컬 DB 스위치(`P1_RUN_LOCAL_DB_TESTS`, `ADMIN_DB_TEST`)는 CI에 없으므로 검사에서도 끈다. 그래서 내 PC와 CI 결과가 같다.

## 4. GitHub 브랜치 보호 (저장소 관리자가 한 번 설정)

관리자 권한이 있는 사람(저장소 주인)만 할 수 있다.

1. 저장소 **Settings → Branches → Add branch protection rule** (또는 Rules → Rulesets)
2. Branch name pattern: `main`
3. 켤 것
   - **Require a pull request before merging**
     - **Require approvals: 1**
   - **Require status checks to pass before merging**
     - **Require branches to be up to date before merging**
     - 검사 목록에서 `frontend`, `backend` 선택 (한 번이라도 CI가 돈 뒤에 목록에 나온다)
   - **Do not allow bypassing the above settings** (관리자도 예외 없음)
4. 끌 것: Allow force pushes, Allow deletions

설정 후에는 CI가 빨간색이거나 승인이 없으면 머지 버튼이 잠긴다.

## 5. 자주 막히는 곳

| 증상 | 해결 |
| --- | --- |
| `Docker가 꺼져 있어요` | Docker Desktop 실행 후 다시 |
| `node_modules가 없어요` | 루트에서 `npm ci` |
| hook이 안 돈다 | 1장 명령을 이 clone에서 실행했는지 확인: `git config core.hooksPath` → `.githooks` |
| 로컬은 통과, CI는 실패 | `git merge origin/main` 후 다시 검사. 그래도 다르면 팀 채널에 CI 로그 공유 |
| 급해서 검사를 건너뛰고 싶다 | `--no-verify`는 쓰지 않는다. 건너뛰어도 브랜치 보호의 CI가 머지를 막는다 |

## 6. AI와 함께 검사하는 방식 (10/27 테스트부터)

AI(Claude Code 등)를 한 번 묻고 끝내는 도구가 아니라, **규칙과 검사가 고정된 작업 시스템**으로 쓴다. 시스템은 저장소에 남아서 다음 사람도 같은 방식으로 돌린다.

| 원칙 | 우리 저장소에서 |
| --- | --- |
| **지시문(맨 위) 고정** | 팀 공통 규칙 `CLAUDE.md`(요약, 원본은 `docs/PROJECT2.md` — 충돌하면 PROJECT2 우선)와 이 가이드. 담당별 skill은 저장소 `.claude/skills/`(예: P3 `p3-orders` 등, #69). AI가 작업 전에 항상 이걸 먼저 읽고 따른다. `CLAUDE.md`는 저장소 루트에 둔다(#70) |
| **멀티스텝: 조건을 만족할 때까지 반복** | 종료 조건 = `backend/scripts/check.py` 통과(마이그레이션·전체 pytest·Docker DB 테스트) + 프론트 lint·typecheck·test + GitHub CI `backend`·`frontend` 초록색. 실패하면 원인을 고치고 다시 돌린다. 통과 전에는 "완료"라고 하지 않는다 |
| **기획 → 구현 → 검증** | 기획: 바꿀 파일·규칙·확인 방법을 먼저 정한다. 구현: "이만하면 됐다"까지. 검증: 계약 문서(API_SPEC·PROJECT2)와 대조해 놓친 것을 찾고 다시 구현으로 |
| **기억은 디스크에** | 대화가 아니라 파일에 남긴다: 작업일지(`docs/worklog/`), 테스트 전략, PR 본문(테스트 숫자·DB 전 → 후), 커밋 메시지. 다음 세션은 이 파일을 읽고 이어간다 |
| **확인과 판단은 사람이** | AI 결과는 사람이 직접 확인한다(화면·Swagger·DB 조회 값). 머지 버튼, 공통 파일 변경, 다른 담당자 코드 수정, 공용 DB 작업은 사람이 결정한다. AI에 넘기지 않는다 |

- 코드·git 작업은 **한 세션에서만** 한다. 다른 세션(오른쪽 패널 탭 등)은 조사·초안만 한다. 두 세션이 같은 브랜치에 커밋하면 PR 내용이 몰래 바뀐다.
- AI가 만든 코드도 실제 실행·검증한 결과만 PR·작업일지에 적는다 (작업 가이드 "AI·외부 자료 출처 기록").
