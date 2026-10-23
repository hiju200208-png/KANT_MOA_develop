# 프로젝트2 개발 기준과 P1 공통 기반

기준일: 2026-10-23. GitHub가 원본이며 Notion·Redmine에는 요약과 이 문서 링크를 연결합니다.

## 인수 기준 및 확인한 사실

- 원본: https://github.com/jin-park0115/KANT_MOA
- 팀 저장소: https://github.com/hiju200208-png/KANT_MOA_develop
- 로컬: `C:\dev\KANT_MOA_develop`, 희주 작업 브랜치: `heeju`.
- 현재 HEAD: `f446b8a948c476acc3442980b71a9ba6ffc21394`; 로컬 `takeover-base` 태그 존재. 원격 태그 등록은 이번 작업에서 확인하지 않았습니다.
- 기존 구현은 Next.js + Supabase Auth/DB/RPC/Storage입니다. 기존 SQL을 일반 PostgreSQL에 그대로 적용하지 않습니다.
- 배포 사이트에서 비회원 검색(응원봉 18건), TWS 응원봉 상세, 최대 2개 제한, 장바구니 추가·새로고침 유지, 배송비 포함 합계, 주문서 로그인 안내를 브라우저로 확인했습니다. 로그인 이후 처리와 DB 직접 검증은 미실시입니다.
- 기존 로컬 프론트는 Supabase 환경변수 누락으로 `next.config.ts` URL 생성에 실패했습니다. 이번 작업에서는 프론트 코드를 수정하지 않았습니다.

## 확정 역할과 소유권

| 담당 | 기능과 추가 책임 |
|---|---|
| 희주 P1 | 공통 환경, Docker DB, 이미지 서빙, auth 4계층, 회원가입·로그인·JWT·블랙리스트 로그아웃·내 정보·USER/ADMIN, CORS·로깅 |
| 상재 P2 | 상품·카탈로그·좋아요 4계층, 검색·필터·페이지네이션, 아티스트·배너·공지·카테고리·인기 순위, 시드·이미지 이관, 재고 규칙 |
| 여름 P3 | 장바구니·비회원 병합·배송지·주문·모의 결제·취소 4계층, 재고 차감·복구의 트랜잭션·rollback |
| 충만 P4 | 관리자 상품 목록·재고 수정 4계층, 관리자 화면·403 검증. 업로드·공지 관리는 선택 |

- 재고 규칙은 P2 상품 도메인의 `decrease_stock` / `increase_stock` 한 곳에 둡니다. P3·P4가 재사용합니다. 0 미만 불가, 잘못된 수량과 재고 부족 거부.
- P3는 주문과 재고의 원자적 저장을 조율합니다. 순수 도메인 계산만으로 동시성 문제가 해결되지는 않으므로 DB 잠금/조건부 갱신 방식은 P2·P3·P4가 합의합니다.
- 공통 파일 `main.py`, `database.py`, `core/`, `compose.yaml` 변경은 P1과 먼저 협의하고 PR로 통합합니다. PR 대상 브랜치는 팀 최종 확인이 필요합니다.
- 담당자별 화면 → API → Domain → Repository → PostgreSQL E2E를 직접 구현·검증합니다.

## 구조와 트랜잭션 계약

```text
Next.js → presentation/router.py + schemas.py
        → application/service.py
        → domain/ (순수 Python 업무 규칙)
        → infrastructure/models.py + repositories.py → PostgreSQL
```

FastAPI 루트는 `backend/src/`입니다. 각 기능은 `auth/`, `products/`, `orders/`, `admin/` 아래 4계층과 각 `__init__.py`를 구성합니다. 이번 커밋 전 작업에는 공통 코드만 있으며 기능 폴더는 담당자가 작성합니다.

`database.Base`를 모든 ORM 모델이 공유합니다. `get_session`은 요청당 AsyncSession을 제공하며 자동 commit하지 않습니다. 응용 서비스가 하나의 업무 단위에서 commit/rollback을 소유합니다. Repository는 commit하지 않고 필요 시 flush하며 ORM↔도메인 변환을 담당합니다. 실패 시 get_session에서도 미완료 트랜잭션을 rollback합니다.

lifespan에서 DB 연결을 검사하고 종료 시 engine을 dispose합니다. 연결 실패 시 서버 시작에 실패합니다. 테이블 생성·시드 자동 덮어쓰기는 하지 않습니다. 현재 테이블·시드·마이그레이션은 미구현이며 최초 스키마/시드 준비 명령을 담당자 통합 후 추가합니다.

## 공통 API 계약

- 기본 주소 `http://localhost:8000`, 경로에 `/api` 접두사는 붙이지 않는 초안입니다.
- 목록: `{ "items": [], "total": 0, "page": 1, "size": 20 }`. page 1 이상, size 1~100(초안), total은 필터 후 페이지 적용 전 개수입니다.
- 오류: `{ "code": "OUT_OF_STOCK", "message": "재고가 부족해요" }`.
- 상태: 422 입력 오류, 401 미인증/토큰 거부, 403 권한 부족, 404 리소스 없음, 409 업무 규칙 위반.
- 서버 내부 실패 500·DB 준비 실패 503은 업무 오류와 별도로 같은 본문 구조를 사용합니다.
- 코드명 기준은 기존 `src/constants/error-messages.ts` / `src/services/errors.ts`입니다. 현재 `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`는 없으므로 공통 처리에서는 임의 추가하지 않고 `UNKNOWN`과 의미 있는 메시지를 사용합니다. 신규 코드가 필요하면 프론트 코드·명세를 함께 합의해 변경합니다.
- 도메인은 FastAPI·SQLAlchemy·Pydantic을 import하지 않습니다. 표현 계층이 도메인 예외를 `core.errors.ApiError` 또는 별도 핸들러로 HTTP에 매핑합니다.

## 인증 계약 초안 (미구현)

다음은 팀원 공유용 설계이며 호출 가능한 API나 의존성 함수가 아직 아닙니다.

| 메서드·경로 | 요청 | 응답·규칙 |
|---|---|---|
| POST `/auth/signup` | JSON email, password, nickname | 201, 공개 사용자 정보. role 입력 금지, USER로 가입 |
| POST `/auth/login` | OAuth2 form username(이메일), password | access_token, token_type=bearer, expires_in |
| GET `/auth/me` | Bearer 토큰 | id, email, nickname, role |
| POST `/auth/logout` | Bearer 토큰 | 204, jti를 DB 블랙리스트에 저장 |

- 사용자 ID: UUID 제안. P2·P3·P4의 사용자 FK는 이를 기준으로 공동 확정합니다.
- `users`: id UUID PK, email unique, password_hash, nickname, role(USER/ADMIN), created_at.
- `token_blacklist`: jti PK, expires_at(timezone-aware). 서버 재시작에도 로그아웃 차단 유지.
- JWT: sub(사용자 UUID), jti, iat, exp, 알고리즘 HS256·30분 만료 제안. 비밀번호는 Argon2 해싱 제안.
- 예정 의존성: `auth.presentation.dependencies.get_current_user` → 공개 사용자 객체(id/role 등, password_hash 제외). `require_admin` → 같은 객체 또는 403.
- 토큰 누락·서명 실패·만료·블랙리스트·없는 사용자 모두 401. ADMIN 검사는 검증된 서버 사용자 정보 기준입니다.
- 관리자 생성은 공개 회원가입으로 허용하지 않고 별도 로컬 초기화 명령으로 제공할 예정입니다. 고정 관리자 비밀번호는 저장소에 넣지 않습니다.
- 브라우저 토큰 저장 방식·세션 복원·사용자 수정 API·이메일/비밀번호 검증 세부 기준은 후속 확정 사항입니다.

## 이미지 계약

- 고정 이미지: `backend/assets/` → `/static/`; 업로드: `backend/uploads/` → `/uploads/`.
- DB에는 `/static/products/example.webp`처럼 상대 경로를 저장하고 프론트에서 API origin과 조합합니다.
- 두 경로는 공개 파일입니다. 개인정보·키·문서 저장 금지. uploads 내용은 Git 제외이며 별도 백업이 필요합니다.
- 현재는 서빙만 구현했습니다. 관리자 업로드·용량/형식 검사·서버 생성 파일명·쓰기 권한 검증은 미구현입니다.
- 이전 팀 Storage 원본 확보·사용 권한 확인과 실제 이관은 P2 담당입니다. 실제 아티스트 저작물은 기존 학습·시연 조건을 유지합니다.

## 로컬 실행 (PowerShell)

전제: Python 3.13+, uv, Docker Desktop(Linux 엔진)이 필요합니다. 현재 확인 환경은 Python 3.13.15, Docker CLI 29.8.0이며 uv는 PATH에 없고 Docker 엔진 연결은 실패했습니다.

1. Docker Desktop을 실행하고 Linux 엔진이 준비됐는지 `docker info`로 확인합니다.
2. 루트 `.env.docker.example`을 `.env`로 복사해 로컬 POSTGRES_PASSWORD를 설정합니다. 비밀번호는 직접 정하고 URL 예약문자를 쓸 경우 DATABASE_URL에서 percent-encoding합니다.
3. 루트에서 `docker compose up -d db`, `docker compose ps`로 healthy 상태를 확인합니다.
4. `backend/.env.example`을 `backend/.env`로 복사하고 DB 비밀번호·포트를 루트 설정과 맞춥니다.
5. uv 설치 후 다음을 실행합니다. 이번 작업 환경에는 uv 0.13.5를 `backend/.venv`에만 설치했습니다. 전역 PATH에는 없으므로 이 환경에서는 `uv` 대신 `.venv/Scripts/uv.exe`를 사용할 수 있습니다.

```powershell
cd C:\dev\KANT_MOA_develop\backend
uv sync
uv run uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

확인: `http://localhost:8000/health` → `{"status":"ok","database":"ok"}`, `http://localhost:8000/docs` → Swagger. 서버와 DB가 실행되어야 성공합니다. 테스트는 backend에서 `uv run pytest`입니다.

종료: 서버 터미널 Ctrl+C, 루트에서 `docker compose stop`. DB는 named volume에 남습니다. `docker compose down -v`는 DB를 삭제하므로 일반 종료에 사용하지 않습니다.

프론트는 별도 `npm run dev`가 필요하며 현재 Supabase 의존성이 남아 있어 새 백엔드만으로 동작하지 않습니다. NEXT_PUBLIC_API_URL 연결·기존 인증/서비스/이미지 설정 교체·미이전 화면 숨김은 후속 작업입니다.

## 10/23 목표와 현재 상태

- 작성: Docker DB 설정, 비동기 세션, lifespan, health/docs, CORS·로깅·공통 오류·목록 스키마, 이미지 서빙.
- 설계: 역할·공통 계약, P1 사용자/블랙리스트 ERD 필드·API·권한 규칙.
- 미완료: 실제 DB 기동/E2E, 인증 4계층·의존성, 테이블·시드, 프론트 전환, 이미지 원본 이관.
- uv.lock 생성과 의존성 설치 완료. 검증 결과는 희주 작업일지에 기록합니다.

## 연결 자료

- 팀 Notion: https://app.notion.com/p/teamsparta/2-4022dc3ef51480c5886cd568134e58d6
- 팀 Redmine: https://sulfite-footbath-next.ngrok-free.dev/projects/2_project?jump=welcome
- 기존 플랫폼: https://kant-moa.vercel.app/
- 제출 2026-10-28 14:00, 발표 14:30. 외부 문서는 이번 작업에서 수정하지 않았습니다.
