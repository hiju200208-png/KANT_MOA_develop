# KANT MOA — 아이돌 굿즈샵 · 프로젝트2

기능 기준: 팀 `main` **e0c7ad8** / 최종 운영 확인: **2026-10-28 KST**.
이 문서 변경은 실행 코드·DB·서버를 바꾸지 않습니다.

이전 팀의 Next.js 쇼핑몰·실제 카탈로그를 인수해 회원·상품·주문·관리자 백엔드를
**FastAPI + PostgreSQL 4계층**으로 전환했습니다. 기존 화면을 유지하며 학원 서버에
Next.js·FastAPI·Nginx를 Docker로 배포했고, API는 같은 서버에 설치된 PostgreSQL로 내부 연결합니다.

| 바로가기 | 주소 |
| --- | --- |
| 홈페이지 | https://letdown-kilometer-nutcase.ngrok-free.dev/ |
| Swagger | https://letdown-kilometer-nutcase.ngrok-free.dev/api/docs |
| OpenAPI | https://letdown-kilometer-nutcase.ngrok-free.dev/api/openapi.json |
| 팀 저장소 | https://github.com/hiju200208-png/KANT_MOA_develop |
| 최종 결과·검증·제한 | [docs/FINAL_STATUS.md](docs/FINAL_STATUS.md) |
| 개발 계약 | [docs/PROJECT2.md](docs/PROJECT2.md) |
| PR·자동 검사 | [docs/PR_GUIDE.md](docs/PR_GUIDE.md) |

공개 `/products`는 **화면**, `/api/products`는 **API**입니다. 로컬 FastAPI(8000)에는
`/api` 접두사가 없고 `/docs`를 사용합니다. 학원 서버 가동·ngrok 상태에 따라 공개 접속은 달라질 수 있습니다.

## 구현한 흐름

- 일반 회원가입·로그인·내 정보 **조회**·로그아웃, JWT·DB 블랙리스트·USER/ADMIN 권한, Google 로그인.
- 상품 목록·검색·필터·정렬·페이지·상세·찜, 아티스트·멤버·배너·좋아요·공지·인기 상품·공개 설정.
- 비회원/회원 장바구니·병합, 배송지 CRUD·기본 지정, 주문·바로 구매·모의 결제·취소·주문 내역.
- 관리자 상품·판매 상태·일괄 변경·재고 조정·대표 이미지·공지·대시보드, 관리자 주문·배송 처리.
- 실제 공개 상품을 참조하는 Gemini 칸트봇, 로딩·빈 상태·오류 안내와 PC/모바일 화면 연결.

결제는 **모의 결제**입니다. 내 정보 수정 API·실제 PG·메일 발송·교환/반품 신청·택배사 연동은 미구현입니다.
비밀번호 재설정 화면·API는 구현·배포됐지만 운영 `PASSWORD_RESET_DEMO=false`를 유지합니다.
메일을 보내 실제 사용자가 비밀번호를 찾는 흐름까지 완료한 것으로 설명하지 않습니다.

## 구성과 책임

```text
Next.js 화면 → FastAPI presentation → application → 순수 domain
                                         ↓
                            infrastructure Repository → PostgreSQL
```

- 요청당 같은 `AsyncSession`을 사용하고 **응용 서비스가 commit/rollback**합니다. Repository는 flush만 합니다.
- P2 `get_variants_for_update`가 옵션 ID 순서의 `FOR UPDATE` 잠금을 제공하며 P3 주문·P4 재고 조정이 재사용합니다.
- API 인증·권한·본인 소유권을 서버에서 검사합니다. 실패·동시성 검사는 일회용 로컬 DB에서 수행합니다.
- 업무 DB·인증은 FastAPI/PostgreSQL입니다. Supabase Storage는 원본 배너 영상 3개 전달에 사용합니다.
  기존 SDK·CLI·과거 SQL/타입/예시 데이터도 저장소에 남아 있으므로 Supabase의 완전 제거를 뜻하지 않습니다.

| 영역 | 사용 기술 |
| --- | --- |
| 화면 | Next.js 16·React 19·TypeScript·Tailwind CSS, Node 24·npm |
| API | Python 3.13+·uv·FastAPI·Uvicorn·Pydantic |
| DB | PostgreSQL, SQLAlchemy 비동기·asyncpg, Alembic |
| 인증 | OAuth2 password form·JWT(PyJWT)·Argon2, Google ID 토큰 검증 |
| 검사 | pytest·HTTPX, Node 테스트·ESLint·TypeScript, GitHub Actions |
| 운영 | Docker 프론트/API/Nginx + 서버 설치 PostgreSQL + ngrok HTTPS |

설치 범위·고정 버전은 `package.json`·`package-lock.json`, `backend/pyproject.toml`·`backend/uv.lock`이 기준입니다.

## 로컬 실행

로컬의 **빈 개발 DB**를 준비하는 안내입니다. 공용 DB 설정을 복사해 실행하지 않습니다.
준비물: Node 24·npm, Python 3.13+·uv, 실행 중인 Docker Desktop(Linux 엔진).

### 1. 저장소·환경 파일

```powershell
git clone https://github.com/hiju200208-png/KANT_MOA_develop.git
cd KANT_MOA_develop
git config core.hooksPath .githooks
Copy-Item .env.docker.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item .env.example .env.local
```

- 루트 `.env`에 로컬 DB 비밀번호·포트를 정하고 `backend/.env`의 `DATABASE_URL`과 맞춥니다.
  URL 예약문자는 percent-encoding하고 `JWT_SECRET`은 별도로 생성한 충분히 긴 임의값을 사용합니다.
- `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`, `API_INTERNAL_URL=http://127.0.0.1:8000`.
  Supabase URL·키는 현재 주요 쇼핑 흐름의 필수 설정이 아닙니다.
- Google 로그인은 `GOOGLE_CLIENT_ID`가 필요합니다. HTTP localhost에서 검증할 때만
  `GOOGLE_COOKIE_SECURE=false`를 사용합니다. 자세한 정책은 [Google 로그인](docs/GOOGLE_LOGIN.md)을 봅니다.
- 칸트봇은 Next.js 서버의 `GEMINI_API_KEY`가 필요합니다. 키가 없거나 AI 호출 실패 시 화면은 키워드 안내로 대체합니다.
- 환경 파일·실제 키·토큰·DB 백업은 Git에 넣지 않습니다.

### 2. DB와 API

```powershell
docker compose up -d db
cd backend
uv sync --locked
uv run alembic upgrade head
uv run uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

`alembic upgrade head`는 위에서 만든 **새 빈 로컬 DB** 대상입니다.
초기 SQL과 최초 migration을 중복 적용하지 않습니다. 기존 공용 DB에는 최초 baseline 도구·초기 SQL을 재실행하지 않습니다.
로컬 Swagger: `http://localhost:8000/docs`.

### 3. 실제 카탈로그·이미지와 화면

상품·이미지는 Git clone만으로 전부 준비되지 않습니다. 원본 이미지는 별도 전달 자산이며
`backend/assets`에 준비해야 합니다. 빈 로컬 DB용 재현·시드·경로 검증은
[카탈로그 이관 안내](docs/products/P2_CATALOG_SEED.md)를 따릅니다. 기존 공용 시드를 덮어쓰지 않습니다.

저장소 루트의 별도 터미널에서:

```powershell
npm ci
npm run dev
```

화면 `http://localhost:3000`, API `http://localhost:8000`.
관리자는 로컬 DB 대상을 확인한 뒤 backend에서 `uv run python scripts/create_admin.py`로 생성합니다.
운영 빌드는 `npm run build`, 기동은 `npm run start`입니다.

## 검사와 협업

```powershell
# 저장소 루트
npm run lint
npm run typecheck
npm test

# backend: 별도 일회용 PostgreSQL로 migration·pytest·P2/P3 DB 검사
uv run python scripts/check.py
```

검사별 passed/skipped와 실행 조건은 [최종 현황](docs/FINAL_STATUS.md)에 구분했습니다.
위 명령은 재현 안내이며 이 문서 수정에서 전체 기능 검사를 새로 실행했다는 뜻은 아닙니다.
개인 브랜치에서 **팀 저장소 main**으로 PR을 올립니다. 인수 원본 저장소나 `develop`이 대상이 아닙니다.
PR 템플릿 체크박스 작성과 GitHub CI·브랜치 보호 설정은 서로 다른 기능입니다.

| 담당 | 실제 범위 | 주요 PR |
| --- | --- | --- |
| 노희주 P1 | 공통 기반·인증·권한·Google·최초 DB 이력 도입 | #2·#3·#49·#63·#80·#81 |
| 이상재 P2·팀 리더 | 상품·카탈로그·좋아요·시드/이미지·공통 재고·통합 검증/배포·성능 개선 | #42·#53·#56·#57·#61·#66·#72·#75·#78·#79·#86 |
| 김여름 P3 | 장바구니·배송지·주문·모의 결제/취소·관리자 배송·CI·검수·오류 화면·칸트봇 보완 | #54·#55·#60·#71·#73·#76·#77·#83·#84 |
| 장충만 P4 | 관리자 상품/재고/이미지/공지/대시보드·화면, 비밀번호 재설정 지원 | #1·#50·#62·#82·#85 |

PR 번호는 모두 [팀 저장소 PR 목록](https://github.com/hiju200208-png/KANT_MOA_develop/pulls?q=is%3Apr)에 해당합니다.

## 문서와 인수 이력

- [현재 개발 계약](docs/PROJECT2.md) · [최종 결과](docs/FINAL_STATUS.md) · [운영 기록](docs/STAGING.md)
- [배포 구성](deploy/staging/SITE.md) · [배포 점검](docs/DEPLOYED_TEST_GUIDE.md) · [P2 인계](docs/SANGJAE_HANDOFF.md)
- [P2 통합 검증](docs/products/P2_TEAM_INTEGRATION.md) · [P3 테스트](docs/TEST_STRATEGY_P3.md) · [P4 설계·검증](docs/admin/P4_ADMIN.md)
- [팀원 작업일지](docs/worklog/) · [정리 전 README 보관본](docs/archive/README_BEFORE_CLOSEOUT_20261028.md)
- `docs/SETUP.md`, `FRONTEND.md`, `BACKEND.md`, `DB_DESIGN.md`, `API_SPEC.md`와 `supabase/`는 인수 자료입니다.
  현재 운영의 DB 초기화·배포 절차로 사용하지 않습니다.

> 비상업적 학습·시연용 프로젝트이며 실제 판매·결제는 이루어지지 않습니다.
> 기존 화면·상품 자료를 만든 인수 팀의 기록과 기여를 보존합니다.
> 실제 아티스트의 이름·로고·상품 이미지·원본 배너 영상 저작권은 각 소속사에 있으며,
> 시연 상품 정보는 실제 판매 정보와 다를 수 있습니다. 본 프로젝트는 아티스트·소속사와 관계가 없습니다.
