# 프로젝트2 개발 기준과 P1 공통 기반

기준일: 2026-10-28. 최종 구현·배포 결과는 [FINAL_STATUS.md](FINAL_STATUS.md)를 먼저 확인합니다. 날짜가 붙은 과거 검증/대기 항목은 당시 기록입니다. GitHub가 원본이며 Notion·Redmine에는 요약과 이 문서 링크를 연결합니다.

## 10/28 Google 로그인 구현·배포

- 기존 일반 인증에 Google ID 토큰 검증·USER 가입·sub 기반 재로그인과 일반 로그인 화면 버튼을 추가해 팀 main에 병합·배포한 작업입니다. [설정·계정 정책·검증 기준](GOOGLE_LOGIN.md)을 확인합니다.
- 같은 이메일의 기존 회원과 자동 연결하지 않으며, 기존 JWT·Repository·장바구니 병합을 재사용합니다. 스키마 변경은 없습니다.
- 로컬 설정 연결 후 실제 Google 로그인 200·새로고침 복원·마이페이지 조회·로그아웃 204와 보호 화면의 로그인 요구까지 확인했습니다.
- PR #80 병합 후 공용 API·웹 배포와 Google 버튼 표시를 확인했습니다. 실행 중이던 P2 웹 개선 커밋도 보존했고 DB 지문·JWT·이미지 동일을 확인했습니다. [배포 기록](GOOGLE_LOGIN.md)을 기준으로 봅니다. 공용 실제 Google 계정 로그인과 비회원 장바구니 병합 화면 검증은 남아 있습니다.

## 10/28 공용 DB 최초 이력·관리자 API 검증 완료

- 새 공용 DB `kant-moa`에 최초 Alembic 이력 `3f21520f9615`와 인증 CHECK·만료 인덱스를 적용했습니다. 상품 시드 백업을 격리 DB에 복원해 검증한 뒤 진행했습니다.
- 적용 전후 업무 테이블 18개의 행 수와 시퀀스 12개 값이 일치했습니다. 상품 389개·옵션 642개·상품 이미지 1,390개를 보존했습니다.
- 관리자 계정을 생성하고 공용 `/api`에서 로그인 200·내 정보 ADMIN 200·관리자 상품 조회 200·로그아웃 204를 확인했습니다. 화면 검증·일반 회원 전체 흐름·Google 로그인은 별도입니다.
- 상세 결과는 [공용 DB 적용 기록](SHARED_DB_BASELINE.md)을 확인합니다. 최초 등록 도구와 초기 SQL은 재실행하지 않습니다. 아래 10/27·10/26 내용은 당시 기록입니다.

## 10/27 새 공용 DB 최초 이력 준비

- 새 대상 DB·계정은 `kant-moa`입니다. 이전 `kant_moa`와 구분하며 최신 [DB 이전 기록](products/DB_TRANSFER_20261027.md)을 확인합니다. 상품 시드도 후속 적용돼 기존 데이터를 보존해야 합니다.
- [최초 Alembic 이력 적용 절차](SHARED_DB_BASELINE.md)와 읽기 전용 비교·명시적 적용 도구를 준비했습니다. 아직 공용 DB에는 실행하지 않았습니다.
- 최신 main `b75580d` 기준 일회용 DB 검증: 마이그레이션 3개 적용 성공, 기본 테스트 395 passed / 88 skipped, P2·P3 별도 Docker DB 테스트 308 passed / 5 skipped. 각 실행에서 기존 TestClient 경고 1개가 남습니다. 마지막 5개는 이미지 원본이 필요한 테스트입니다.
- 작업 중 추가된 main `4376fd2`도 병합해 재검증했습니다. 최종 로컬 결과는 기본 **397 passed / 88 skipped**, 별도 Docker DB **310 passed / 5 skipped**입니다. [Draft PR #63](https://github.com/hiju200208-png/KANT_MOA_develop/pull/63)에서 최초 이력 절차를 검토합니다.
- PR 리뷰·병합·현재 백업·적용 시점 공유 후 전체 구조 비교를 통과한 대상에만 인증 차이와 최초 이력을 같은 트랜잭션으로 적용합니다. 직접 `stamp head`하거나 초기 SQL을 재실행하지 않습니다.

## 10/26 공용 서버·DB 적용 업데이트

현재 서버 구성·적용 스키마·검증·후속 작업은 [STAGING.md](STAGING.md)를 먼저 확인합니다.
아래 로컬 실행 방법은 개인 개발용이며, 공용 서버와 구분합니다.

- 공용 서버의 기존 PostgreSQL 18 안에 `kant_moa` 전용 DB·계정을 만들고 테이블 18개를 적용했습니다.
- `profiles`를 `users`로 대체하고 회원 FK를 연결했습니다. 일반 로그인과 Google 로그인 병행을 위해
  `google_sub`와 nullable `password_hash`를 준비했습니다. 일반 인증은 P1 로컬에서 구현·검증했으며 공용 서버 반영은 별도 후속 작업입니다. Google 로그인은 미구현입니다.
- 서버 FastAPI의 DB 연결과 [외부 Swagger](https://letdown-kilometer-nutcase.ngrok-free.dev/docs)를 확인했습니다.
  현재 OpenAPI 등록 경로는 `/health`뿐이며, 시드·기능 API·프론트 연동은 완료하지 않았습니다.
- 공용 DB의 팀원 PC 직접 접속 경로와 ngrok 상시 실행은 아직 설정하지 않았습니다.
- 테이블 생성 원본: [backend/sql/001_create_tables.sql](../backend/sql/001_create_tables.sql).
  공용 서버에 이미 적용된 초기 SQL을 반복 실행하거나 기존 테이블을 초기화하지 않습니다.

## 인수 기준 및 확인한 사실

- 원본: https://github.com/jin-park0115/KANT_MOA
- 팀 저장소: https://github.com/hiju200208-png/KANT_MOA_develop
- 로컬: `C:\dev\KANT_MOA_develop`, 희주 작업 브랜치: `heeju`.
- 인수 기준 커밋: `f446b8a948c476acc3442980b71a9ba6ffc21394`; 로컬 `takeover-base` 태그 존재. 현재 작업 HEAD와 구분하며, 원격 태그 등록은 이번 작업에서 확인하지 않았습니다.
- 기존 구현은 Next.js + Supabase Auth/DB/RPC/Storage입니다. 기존 SQL을 일반 PostgreSQL에 그대로 적용하지 않습니다.
- 배포 사이트에서 비회원 검색(응원봉 18건), TWS 응원봉 상세, 최대 2개 제한, 장바구니 추가·새로고침 유지, 배송비 포함 합계, 주문서 로그인 안내를 브라우저로 확인했습니다. 로그인 이후 처리와 DB 직접 검증은 미실시입니다.
- 기존 로컬 프론트는 Supabase 환경변수 누락으로 `next.config.ts` URL 생성에 실패했습니다. 이번 작업에서는 프론트 코드를 수정하지 않았습니다.

## 확정 역할과 소유권

| 담당 | 기능과 추가 책임 |
|---|---|
| 희주 P1 | 공통 환경, Docker DB, 이미지 서빙, auth 4계층, 회원가입·로그인·JWT·블랙리스트 로그아웃·내 정보·USER/ADMIN, CORS·로깅 |
| 상재 P2 | 상품·카탈로그·좋아요 4계층, 검색·필터·페이지네이션, 아티스트·배너·공지·카테고리·인기 순위, 시드·이미지 이관, 재고 규칙, 통합 검증·배포·성능 개선 |
| 여름 P3 | 장바구니·비회원 병합·배송지·주문·모의 결제·취소 4계층, 재고 차감·복구의 트랜잭션·rollback, 관리자 주문·배송 |
| 충만 P4 | 관리자 상품·상태/일괄 변경·재고·이미지·공지·대시보드 4계층, 관리자 화면·403 검증, 비밀번호 재설정 지원 |

- 재고 규칙은 P2 상품 도메인의 `decrease_stock` / `increase_stock` 한 곳에 둡니다. P3·P4가 재사용합니다. 0 미만 불가, 잘못된 수량과 재고 부족 거부.
- P3는 주문과 재고의 원자적 저장을 조율합니다. 순수 도메인 계산만으로 동시성 문제가 해결되지는 않으므로 P2의 ID 오름차순 FOR UPDATE 잠금 조회·save_variant(flush)를 P3·P4가 같은 세션에서 재사용합니다.
- 공통 파일 `main.py`, `database.py`, `core/`, `compose.yaml` 변경은 P1과 먼저 협의하고 PR로 통합합니다. PR 대상은 팀 저장소의 main입니다.
- 담당자별 화면 → API → Domain → Repository → PostgreSQL E2E를 직접 구현·검증합니다.

## 구조와 트랜잭션 계약

```text
Next.js → presentation/router.py + schemas.py
        → application/service.py
        → domain/ (순수 Python 업무 규칙)
        → infrastructure/models.py + repositories.py → PostgreSQL
```

FastAPI 루트는 `backend/src/`입니다. 각 기능은 `auth/`, `products/`, `orders/`, `admin/` 아래 4계층과 각 `__init__.py`를 구성합니다. P1~P4 기능은 팀 main에 통합됐습니다. 기능 구현·개별 검증·운영 배포는 최종 현황의 근거와 범위를 구분합니다.

`database.Base`를 모든 ORM 모델이 공유합니다. `get_session`은 요청당 AsyncSession을 제공하며 자동 commit하지 않습니다. 응용 서비스가 하나의 업무 단위에서 commit/rollback을 소유합니다. Repository는 commit하지 않고 필요 시 flush하며 ORM↔도메인 변환을 담당합니다. 실패 시 get_session에서도 미완료 트랜잭션을 rollback합니다.

lifespan에서 DB 연결을 검사하고 종료 시 engine을 dispose합니다. 연결 실패 시 서버 시작에 실패합니다. 테이블 생성·시드 자동 덮어쓰기는 하지 않습니다. 10/26 공용 DB에는 초기 SQL로 테이블 18개를 적용했습니다. 현재는 최초 이력 도입과 배송 후속 migration 적용을 완료했습니다. 업무 테이블 19개와 이력 테이블은 구분하며, 초기 SQL을 재실행하지 않습니다. 적용 결과는 [최종 현황](FINAL_STATUS.md)을 확인합니다.

## 공통 API 계약

- 로컬 기본 주소는 `http://localhost:8000`이며 `/api` 접두사가 없습니다. 공개 gateway는 `/api`를 붙이므로 Swagger는 `/api/docs`입니다.
- 목록: `{ "items": [], "total": 0, "page": 1, "size": 20 }`. page 1 이상, size 1~100, total은 필터 후 페이지 적용 전 개수입니다.
- 오류: `{ "code": "OUT_OF_STOCK", "message": "재고가 부족해요" }`.
- 상태: 422 입력 오류, 401 미인증/토큰 거부, 403 권한 부족, 404 리소스 없음, 409 업무 규칙 위반.
- 서버 내부 실패 500·DB 준비 실패 503은 업무 오류와 별도로 같은 본문 구조를 사용합니다.
- 코드명 기준은 기존 `src/constants/error-messages.ts` / `src/services/errors.ts`입니다. 현재 `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`는 없으므로 공통 처리에서는 임의 추가하지 않고 `UNKNOWN`과 의미 있는 메시지를 사용합니다. 신규 코드가 필요하면 프론트 코드·명세를 함께 합의해 변경합니다.
- 도메인은 FastAPI·SQLAlchemy·Pydantic을 import하지 않습니다. 표현 계층이 도메인 예외를 `core.errors.ApiError` 또는 별도 핸들러로 HTTP에 매핑합니다.

## 인증 계약 (P1 구현·팀 main 병합·배포 완료)

일반 로그인 API·인증 의존성은 [PR #49](https://github.com/hiju200208-png/KANT_MOA_develop/pull/49), 최초 이력 보정은 #63, Google 로그인은 #80으로 병합·배포했습니다. 실제 Google 전체 화면 E2E와 메일 발송 같은 미완료 범위는 [최종 현황](FINAL_STATUS.md)에 구분합니다.

| 메서드·경로 | 요청 | 응답·규칙 |
|---|---|---|
| POST `/auth/signup` | JSON email, password, nickname | 201, 공개 사용자 정보. role 입력 금지, USER로 가입 |
| POST `/auth/login` | OAuth2 form username(이메일), password | access_token, token_type=bearer, expires_in |
| GET `/auth/me` | Bearer 토큰 | id, email, nickname, role |
| POST `/auth/logout` | Bearer 토큰 | 204, jti를 DB 블랙리스트에 저장 |

- 사용자 ID: 공용 DB에 UUID로 적용했습니다. P2·P3·P4의 사용자 FK는 `users.id`를 참조합니다.
- `users`: id UUID PK, google_sub unique(nullable), email unique, password_hash(nullable), nickname, phone(nullable), role(USER/ADMIN), created_at. 일반 회원가입은 Python UUID v4와 USER 역할을 사용하며 이메일 공백 제거·소문자 정규화를 적용합니다. 로그인 수단 필수·이메일 정규화 CHECK는 공용 최초 이력 도입 시 적용했습니다. Google 로그인은 구현됐으며 같은 이메일의 기존 계정 자동 연결은 거부합니다.
- `token_blacklist`: jti PK, expires_at(timezone-aware). 서버 재시작에도 로그아웃 차단 유지.
- JWT: HS256·30분 만료를 기본으로 sub(사용자 UUID), jti, iat, exp, iss를 사용합니다. 비밀번호는 Argon2로 해싱합니다. `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`, `JWT_ISSUER`는 환경변수로 설정하며 실제 비밀키는 Git·문서에 기록하지 않습니다.
- 구현 의존성: `auth.presentation.dependencies`의 `get_current_user`, `require_admin`. 반환 클래스는 같은 모듈의 `CurrentUser`이며 `id: uuid.UUID`, `email: str`, `nickname: str`, `role: str`로 구성됩니다. role은 `USER`/`ADMIN` 문자열이고 JSON의 id는 UUID 문자열입니다. 비밀번호 해시는 반환하지 않습니다.
- 토큰 누락·서명 실패·만료·블랙리스트·없는 사용자 모두 401. ADMIN 검사는 검증된 서버 사용자 정보 기준입니다.
- 관리자 생성은 공개 API로 허용하지 않습니다. backend에서 `uv run python scripts/create_admin.py`로 이메일·닉네임·숨김 비밀번호를 입력합니다. 현재 환경변수가 가리키는 DB에 생성되므로 로컬/공용 대상을 먼저 확인해야 합니다. 기존 이메일은 생성 거부하며 자동 승격·비밀번호 덮어쓰기는 하지 않습니다. 서버에서는 리뷰·배포·적용 절차를 거친 뒤 사용합니다.
- 회원가입 스키마는 이메일 형식, 닉네임 1~50자, 비밀번호 8~128자를 검증하며 role 등 추가 필드는 거부합니다.
- 브라우저 공통 session 모듈의 토큰 저장·복원 및 Google 로그인은 연결됐습니다. 회원 정보 수정 API는 미연결입니다. 비밀번호 재설정 API·화면은 #85로 추가됐지만 운영 시연 모드는 false이며 메일 발송은 미구현입니다.

팀원 사용 예시:

```python
from typing import Annotated
from fastapi import Depends
from auth.presentation.dependencies import CurrentUser, get_current_user, require_admin

# 일반 보호 API의 매개변수
# user: Annotated[CurrentUser, Depends(get_current_user)]
# 관리자 API의 매개변수
# user: Annotated[CurrentUser, Depends(require_admin)]
```

소유자 ID는 검증된 `user.id`를 사용합니다. 프론트 요청의 user_id나 검증하지 않은 JWT payload를 신뢰하지 않습니다. 로그인은 OAuth2 form의 username에 이메일을 전달하고 이후 요청에 `Authorization: Bearer <access_token>`을 사용합니다. Swagger에서는 Authorize로 인증을 설정합니다. 로그아웃은 204, 동일 토큰 재요청은 401이며 반복 로그아웃도 401입니다.

## 10/26 로컬 마이그레이션 및 당시 공용 적용 대기 기록

로컬에서 다음 단일 revision 계보를 적용했습니다.

| revision | 이전 revision | 내용 |
|---|---|---|
| `cd2b7db3c89b` | 없음 | users·token_blacklist, 인증 CHECK 두 개·role CHECK·만료 인덱스 생성 |
| `b49bcc205bbc` | `cd2b7db3c89b` | 나머지 16개 테이블과 기본 배송지 부분 UNIQUE 인덱스 추가 |
| `3f21520f9615` | `b49bcc205bbc` | users.role을 TEXT로 변경, users.id에 gen_random_uuid() 기본값 추가 |

- 사용자 실행 결과로 로컬 `localhost:5433/kantmoa`의 head `3f21520f9615`, 업무 테이블 18개 + alembic_version 총 19개를 확인했습니다. 기존 인증 테이블을 초기화하지 않았습니다.
- `env.py`는 auth·products 모델 7개를 수집합니다. DB에만 있고 ORM에 없는 테이블의 자동 삭제안은 include_object로 제외합니다. 전체 18개 ORM 등록이나 모든 삭제 방지를 의미하지 않습니다. 관리 중인 테이블의 컬럼·제약·인덱스 변경안은 계속 검토해야 합니다.
- `alembic check`: `No new upgrade operations detected.` 확인. 이는 수집된 모델의 자동 감지 범위 결과이며, 전체 18개 구조·CHECK의 완전한 일치 증빙은 아닙니다.
- users.role은 TEXT지만 기본값·role CHECK 표현에 이전 VARCHAR 캐스트가 남아 있습니다. 허용값은 USER/ADMIN으로 유지되며 정확한 공용 스키마 대조 시 표현·제약 이름 차이를 별도로 검토합니다.
- 공용 DB 읽기 전용 조회: DB·사용자 kant_moa, public.alembic_version 없음. users·token_blacklist 정의를 확인했으며 로그인 수단 누락·이메일 정규화 위반·정규화 후 이메일 중복 그룹은 조회 당시 모두 0건이었습니다.
- 공용 DB에는 `ck_users_login_method`, `ck_users_email_normalized`, `ix_token_blacklist_expires_at`이 없습니다. 로컬 최초 revision에 이 변경이 포함되므로 **공용에 최초 생성 revision을 실행하거나 로컬 head를 바로 stamp하지 않습니다.**
- 공용 적용 전 전체 스키마·제약·기본값·인덱스를 기준 결과와 대조하고, 기존 테이블을 재생성하지 않는 최초 이력 등록·차이 적용 절차를 팀과 합의해야 합니다. 그 절차와 후속 변경은 아직 미완료입니다.
- 공용 DB 변경은 로컬 검증·PR 리뷰·병합 후 담당자가 적용 전 내용·시점을 공유하고 한 명씩 진행합니다. 적용 후 버전·검증 결과를 기록하며 초기 SQL 재실행·reset·실패 테스트는 하지 않습니다. 이번 P1 작업에서 공용 DB 스키마·이력 변경은 하지 않았습니다.

## 10/26 검증 결과와 테스트 실행

- 최신 팀 main `0e8cceb`을 heeju에 충돌 없이 병합한 뒤 재검증: **181 passed, 17 skipped, 1 warning (14.65s)**. `P1_RUN_LOCAL_DB_TESTS=1`을 사용했으며 관리자·상품의 선택 실행 DB 테스트는 건너뛰었습니다. `alembic check`도 추가 변경 없이 통과했고 단일 head는 `3f21520f9615`입니다. 아래 결과는 이전 검증 기록입니다.

- 최초 P1 인증 단독 구성: 사용자 실행 결과 18 passed.
- main의 P2·P4 코드 통합 후 전체 실행에서 가짜 DATABASE_URL 설정 충돌로 인증 DB 테스트 4개가 실패했습니다. 해당 4개만 별도 실행하면 통과했습니다.
- `tests/conftest.py`에서 명시적 로컬 실행 플래그를 선택하면 테스트 수집 전에 backend/.env를 읽도록 정리했습니다. 로컬 호스트만 허용하며 실제 DB URL·비밀값을 테스트에 하드코딩하지 않습니다.
- 이후 사용자 실행 결과: **76 passed, 3 skipped, 1 warning (13.80s)**. P2 전용 DB 실행 플래그가 없는 테스트 3개는 실행되지 않았습니다. TestClient의 httpx 사용 중단 예고 경고 1개가 남아 있습니다. 팀원이 별도 조합으로 보고한 171개 통과와 구분합니다.
- Swagger 사용자 확인: 회원가입 201(USER·해시 미노출), 로그인·내 정보 200, 로그아웃 204 후 동일 토큰의 내 정보 401.
- 실제 JWT·DB를 사용하는 권한 자동 테스트: 미인증 401 / USER 403 / ADMIN 200. 로컬 관리자 CLI 생성 성공도 사용자 결과로 확인했습니다.

backend에서 로컬 DB 연결 대상을 확인한 뒤 실행합니다. 테스트는 고유 테스트 회원을 생성·정리하므로 공용 DB 대상으로 실행하지 않습니다.

```powershell
$env:P1_RUN_LOCAL_DB_TESTS = "1"
try {
    uv run pytest -q
} finally {
    Remove-Item Env:P1_RUN_LOCAL_DB_TESTS -ErrorAction SilentlyContinue
}
```

P2의 별도 PostgreSQL 테스트는 기존 `P2_RUN_POSTGRES_TESTS` 계약을 따릅니다. 이 문서의 결과에는 해당 3개 실행을 포함하지 않습니다.

## 이미지 계약

- 고정 이미지: `backend/assets/` → `/static/`; 업로드: `backend/uploads/` → `/uploads/`.
- DB에는 `/static/products/example.webp`처럼 상대 경로를 저장하고 프론트에서 API origin과 조합합니다.
- 두 경로는 공개 파일입니다. 개인정보·키·문서 저장 금지. uploads 내용은 Git 제외이며 별도 백업이 필요합니다.
- 대표 이미지 교체는 P4 #50에서 JPG/PNG/WebP·5MB·매직 바이트 검사와 서버 생성 파일명을 구현했습니다. DB 실패 시 이번 요청의 파일만 정리하며 기존 이미지·commit 후 참조 파일은 보존합니다.
- P2는 실제 카탈로그와 원본 이미지 이관을 완료했습니다. 원본 파일은 별도 준비 자산이며 Git clone만으로 전부 복원되지 않습니다. 실제 아티스트 저작물은 기존 학습·시연 조건을 유지합니다.

## 로컬 실행 (PowerShell)

전제: Python 3.13+, uv, Docker Desktop(Linux 엔진)이 필요합니다. Python 3.13.15, Docker CLI 29.8.0 환경에서 확인했습니다. 2026-10-24 사용자 로컬에서 Docker PostgreSQL 정상 기동과 FastAPI 실제 DB 연결, `/health` 및 Swagger에서 200 응답을 확인했습니다.

로컬 5432 포트 바인딩이 실패하여 호스트 포트를 5433으로 변경했습니다. 루트 `.env`의 `POSTGRES_PORT=5433`과 `backend/.env`의 `DATABASE_URL` 포트 5433을 일치시켰습니다. 컨테이너 내부 PostgreSQL 포트는 5432를 유지하며, 다른 팀원은 각자 사용 가능한 호스트 포트를 설정하면 됩니다.

uv는 프로젝트 가상환경에 설치되어 있으며 전역 PATH에는 등록하지 않았습니다.

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

인증 설정으로 backend/.env의 JWT_SECRET 등 항목도 준비해야 합니다. 신규의 빈 로컬 DB는 backend에서 `uv run alembic upgrade head`로 테이블을 준비한 뒤 서버를 실행합니다. 기존 공용 DB에는 이 명령을 그대로 실행하지 않습니다. 로컬 SQL 초기화와 Alembic 최초 생성을 중복 적용하지 않습니다.

확인: `http://localhost:8000/health` → `{"status":"ok","database":"ok"}`, `http://localhost:8000/docs` → Swagger. 서버와 DB가 실행되어야 성공합니다. 테스트는 위 로컬 실행 플래그를 사용합니다.

종료: 서버 터미널 Ctrl+C, 루트에서 `docker compose stop`. DB는 named volume에 남습니다. `docker compose down -v`는 DB를 삭제하므로 일반 종료에 사용하지 않습니다.

프론트는 별도 `npm run dev`가 필요합니다. `.env.local`의 NEXT_PUBLIC_API_URL·API_INTERNAL_URL을 로컬 API로 지정하면 주요 쇼핑·인증 화면이 FastAPI를 사용합니다. Supabase SDK·과거 자료는 남아 있지만 현재 주요 흐름의 Supabase 키는 필수가 아닙니다. Google·칸트봇은 별도 설정이 필요하며 내 정보 수정·메일 발송은 미구현입니다.

## 10/23 목표와 현재 상태

- 작성: Docker DB 설정, 비동기 세션, lifespan, health/docs, CORS·로깅·공통 오류·목록 스키마, 이미지 서빙.
- 설계: 역할·공통 계약, P1 사용자/블랙리스트 ERD 필드·API·권한 규칙.
- 10/24 추가 확인: Docker DB healthy, FastAPI `/health` DB 연결 성공, Swagger Execute에서 200 응답 확인.
- 준비 완료: `auth/` 및 presentation/application/domain/infrastructure 패키지와 각 `__init__.py` (사용자 생성 완료 확인).
- 10/26 추가 확인: 공용 DB 테이블 18개·소유자 확인, 학원 서버 FastAPI healthy·DB 연결, ngrok 외부 health/docs 응답 확인. [상세 기록](STAGING.md).
- 10/26 P1 로컬 완료: 일반 인증 4계층·JWT·블랙리스트·권한 의존성·관리자 CLI, 로컬 마이그레이션 head `3f21520f9615`. 상세 구현과 검증 결과는 위 내용을 참고합니다.
- 미완료: 공용 baseline 이력·스키마 대조와 차이 적용·서버 인증 배포, 전체 모델 통합·시드, Google 로그인, 프론트 토큰 저장·복원과 화면 E2E, 이미지 원본 이관, 팀원 PC의 공용 DB 직접 접속·ngrok 상시 실행.
- uv.lock 생성과 의존성 설치 완료. 검증 결과는 희주 작업일지에 기록합니다.

## 연결 자료

- 팀 Notion: https://app.notion.com/p/teamsparta/2-4022dc3ef51480c5886cd568134e58d6
- 팀 Redmine: https://sulfite-footbath-next.ngrok-free.dev/projects/2_project?jump=welcome
- 기존 플랫폼: https://kant-moa.vercel.app/
- 제출 2026-10-28 14:00, 발표 14:30. 외부 문서는 이번 작업에서 수정하지 않았습니다.

## 10/27 추가 범위 — 관리자 주문·배송 (P3, 사용자 승인)

KANT MOA 대화의 16:09 관리자 연동 문의를 확인한 뒤, 여름이 이번 제출에 추가하기로 승인했다. P3가 관리자 주문·배송을 구현하며 P4 기존 상품·재고 기능과 분리한다. 코드·로컬 검증과 공용 적용은 구분한다.

- 화면 `/admin/orders`: ADMIN 전체 주문 목록, 주문번호·상품명·받는 분 검색, 결제·배송 상태 필터, 20건 페이지 조회, 배송 정보 및 처리 시각.
- API `GET /orders/admin`, `PATCH /orders/admin/{order_id}/shipping`: P1 `require_admin`으로 401·403을 서버에서 검증한다. 기존 P3 라우터에 정적 관리자 경로를 먼저 등록하므로 공통 main.py 변경은 없다.
- 결제 상태 pending/paid/cancelled를 유지한다. 배송은 paid 주문만 preparing → shipped → delivered. 단계 생략·역행·중복, 미결제·취소 주문 발송은 409 INVALID_ORDER. 형식·허용값 오류는 422 UNKNOWN.
- 발송 이후 고객의 일반 취소는 409 INVALID_ORDER로 막아 출고 재고가 복구되지 않게 한다. 반품·환불·택배사/운송장 연동은 범위 밖이다.
- 발송·취소 모두 사용자 행 → 주문 행 잠금. 배송 기록·처리 관리자·시각은 같은 세션에서 저장하고 서비스가 한 번 commit/실패 시 rollback한다. 배송 처리 자체는 상품·재고·결제 상태를 변경하지 않는다.
- 후속 revision `4c726d1a91ab`(부모 `3f21520f9615`)은 `order_shipments` 테이블만 추가한다. 기존 주문·회원·상품·재고는 수정하지 않는다.
- **배포 순서 필수:** 최신 백업·팀 적용 공지 → 최초 baseline 이력(3f21520f9615) 대조·채택 → 승인된 후속 배송 migration → 새 API 배포 → 관리자 화면 배포/검증. 새 취소 코드는 배송 테이블을 읽으므로 migration 전에 코드를 배포하지 않는다. 이 순서는 이후 공용 baseline 도입·배송 migration·최신 API/프론트 배포로 완료했습니다. 당시 계획과 최종 적용 결과는 [최종 현황](FINAL_STATUS.md)을 대조합니다.
- 최초 이력 도구의 비교 DB는 전용 로컬 DB를 `alembic upgrade 3f21520f9615`로 준비한다. 저장소에는 알려진 단일 배송 head와 정확한 부모만 추가 허용하고 미검토·복수 head 거부는 유지한다. 최초 채택이 기록하는 revision은 계속 3f21520f9615다.
