# KANT MOA 프로젝트(2) · 2조 팀 공통 규칙

> 이 파일은 2조 팀 공통 규칙이다. 상세 계약의 원본은 `docs/PROJECT2.md`이며, 충돌하면 PROJECT2.md를 따른다.

## Critical Rules (절대 규칙)
- `main` 브랜치에 직접 push 금지. 개인 브랜치에서 작업하고 반드시 PR로 병합한다.
- `.env`, 비밀번호, JWT, API 키, DB 접속 정보는 절대 커밋하지 않는다. 코드·로그·문서·스크린샷에도 넣지 않는다.
- `docker compose down -v` 금지 (DB 볼륨 삭제). 일반 종료는 `docker compose stop`.
- 공통 파일 `backend/src/main.py`, `database.py`, `core/`, `compose.yaml` 수정은 P1(희주)과 먼저 협의하고 PR로 통합한다.
- 다른 담당자의 기능 폴더를 수정하지 않는다. 필요하면 담당자에게 요청한다.
- 재고를 바꾸는 코드를 새로 만들지 않는다. P2 상품 도메인의 `decrease_stock` / `increase_stock`과 P2 Repository의 잠금 조회 함수를 호출한다.
- 테이블 자동 생성·시드 덮어쓰기를 하지 않는다. 스키마·시드 변경은 책임자 승인 후 PR.

## 프로젝트 개요
- 이전 3조 KANT_MOA(아이돌 굿즈샵, Next.js + Supabase)를 인수해 Supabase를 FastAPI 백엔드로 대체한다.
- 하나의 FastAPI 서버에서 P1~P4가 각자 담당 기능의 4계층을 직접 구현하고 화면 → API → 도메인 → PostgreSQL까지 검증한다.
- 제출 2026-10-28 14:00, 발표 14:30.

## 담당과 폴더
| 담당 | 이름 | 범위 | 폴더 |
| --- | --- | --- | --- |
| P1 | 희주 | 공통 환경, 이미지 서빙, 회원가입·로그인·JWT·블랙리스트·내 정보·USER/ADMIN, CORS·로깅 | `auth/` |
| P2 | 상재 | 상품·카탈로그·좋아요, 검색·필터·페이지네이션, 시드·이미지 이관, 재고 규칙 소유 | `products/` |
| P3 | 여름 | 장바구니·비회원 병합·배송지·주문·모의 결제·취소, 재고 차감·복구 트랜잭션·rollback | `orders/` |
| P4 | 충만 | 관리자 상품 목록·재고 수정, 관리자 화면, 403 검증 | `admin/` |

## Tech Stack
- 백엔드: Python 3.13+, uv, FastAPI, PostgreSQL(Docker), SQLAlchemy 2 비동기 + asyncpg, Pydantic
- 프론트: Next.js 16 (기존 3조 코드), Node 24, npm, 포트 3000
- 인증: OAuth2 password, JWT(sub=사용자 UUID, jti, HS256), Argon2 해싱, DB 블랙리스트

## 아키텍처 (4계층)
Next.js → presentation/router.py + schemas.py → application/service.py → domain/ (순수 Python) → infrastructure/models.py + repositories.py → PostgreSQL
- FastAPI 루트: `backend/src/`. 기능 폴더마다 4계층 패키지와 각 `__init__.py`.
- 의존 방향: presentation → application → domain. infrastructure는 domain 객체로 변환해 반환한다. 역참조·순환 참조 금지.
- domain은 FastAPI·SQLAlchemy·Pydantic을 import하지 않는다.

## 트랜잭션 계약
- `get_session`은 요청당 AsyncSession을 주고 자동 commit하지 않는다.
- commit/rollback은 응용 서비스가 하나의 업무 단위에서 소유한다.
- Repository는 commit하지 않는다. 필요하면 flush만 하고 ORM ↔ 도메인 변환을 담당한다.
- 재고 변경 시 `SELECT ... FOR UPDATE`로 잠그고, 여러 옵션은 id 오름차순으로 잠근다(데드락 방지).

## 공통 API 계약
- 기본 주소 `http://localhost:8000`, `/api` 접두사 없음.
- 목록 응답: `{ "items": [], "total": 0, "page": 1, "size": 20 }`
- 오류 응답: `{ "code": "OUT_OF_STOCK", "message": "재고가 부족해요" }`
- 상태 코드: 422 입력 오류 / 401 미인증·토큰 거부 / 403 권한 부족 / 404 없음 / 409 업무 규칙 위반 / 500·503 서버·DB
- 오류 code 이름은 프론트 `src/constants/error-messages.ts`, `src/services/errors.ts` 기준. 없는 코드는 `UNKNOWN` + 의미 있는 메시지.
- 인증 의존성: `from auth.presentation.dependencies import get_current_user, require_admin` (P1 구현 전에는 임시 의존성)

## Build / Test Commands (PowerShell)
- DB: 루트에서 `docker compose up -d db`, `docker compose ps`
- 서버: `cd backend` → `uv sync` → `uv run uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000`
- 테스트: `uv run pytest`
- 확인: `/health` → `{"status":"ok","database":"ok"}`, `/docs` → Swagger
- 5432 포트 차단 시 루트 `.env`의 `POSTGRES_PORT`와 `backend/.env`의 `DATABASE_URL` 포트를 5433 등으로 맞춘다.

## Coding Conventions
- 세부 규칙은 `.claude/skills/code-rules/SKILL.md`를 따른다.
- 모든 목록 API는 검색·필터·페이지네이션을 지원한다.
- 보호된 API는 `Depends(get_current_user)` + 서버에서 소유권 검사(403).
- AI가 생성한 코드도 직접 실행·검증한 결과만 완료로 기록한다.