# P2 6단계 · 상품 찜 API·P1 인증 연결

2026-10-27 KST. 로컬 구현·검증 완료. 사용자의 재요청으로 6단계 PR을 준비한다. 서버 배포는 후속이다.
프론트의 Supabase 호출 전환은 7단계다.

## 기준 코드와 보존

- 최신 팀 main `b6252a7`(P3 PR #55 포함)을 `feature/sangjae`에 fast-forward했다.
- 기존 미커밋 5단계 배포 기록 두 문서는 Git 제외 경로에 백업한 뒤 그대로 보존했다.
- P1 `get_current_user`, `CurrentUser.id: UUID`, 공통 `get_session`·오류 형식을 재사용한다.
  JWT 생성·검증·로그아웃 차단 코드를 P2에 다시 만들지 않았다.
- 기존 `src/services/wishlist.ts`의 목록/ID 조회/단건 여부/토글 호출을 확인했다.
  프론트 파일은 이번 단계에서 수정하지 않았다.

## API 계약

모든 경로는 P1 Bearer 인증이 필요하다. 미로그인·잘못된 서명·만료·로그아웃·삭제된 회원의 토큰은
401 `NOT_AUTHENTICATED`와 `WWW-Authenticate: Bearer`를 반환한다.
사용자 ID는 요청이 아닌 검증된 `current_user.id`에서만 가져온다.

| API | 성공 응답 | 의미 |
|---|---|---|
| `GET /wishlist?page=1&size=20` | 200 `{items,total,page,size}` | 본인 찜의 공개 상품 요약 |
| `GET /wishlist/ids` | 200 `[상품 ID, ...]` | 본인 찜 중 공개 가능한 상품 ID 전체 |
| `PUT /wishlist/{product_id}` | 200 `{product_id,is_wished:true}` | 찜 상태로 지정, 중복 호출도 성공 |
| `DELETE /wishlist/{product_id}` | 200 `{product_id,is_wished:false}` | 해제 상태로 지정, 반복 호출도 성공 |

- page 기본 1, 범위 1..2,147,483,647. size 기본 20, 범위 1..100.
- 상품 ID는 양의 PostgreSQL bigint 범위다. 잘못된 입력은 공통 422 `{code,message}`.
- 최근 찜 순: `wishlists.created_at DESC, product_id DESC`. 같은 시각도 ID로 안정화한다.
  중복 PUT은 기존 created_at을 바꾸지 않는다.
- 목록·ID 조회는 `on_sale`, `sold_out`만 노출한다. 숨김은 total에서도 제외한다.
  옵션 여러 개로 상품이 중복되지 않으며 재고 기반 품절 등은 5단계 Product 도메인/응답을 재사용한다.
- 없는 상품·hidden 상품 PUT은 404 `UNKNOWN`, 메시지 `상품을 찾을 수 없어요.`.
  hidden 기존 찜은 저장된 채 조회에서 제외되며 DELETE로 해제할 수 있다.
  이미 삭제된 상품·찜의 DELETE도 성공한다.
- GET 두 경로에 `Cache-Control: private, no-store`를 지정해 개인 응답의 공용 캐시 저장을 막는다.
- 요청에 다른 user_id를 넣어도 다른 사람 행을 수정하지 않는다. 목록의 알 수 없는 쿼리 항목은 422다.
  추가·해제에는 user_id 입력 필드가 없고 인증된 본인의 행만 다룬다.
- 본인 경로만 제공하므로 타 회원 ID를 받는 조회/수정 API나 별도 403 경로는 없다.

## 멱등성·동시성·트랜잭션

기존 프론트의 toggle은 재시도하면 반대로 바뀔 수 있어 API에는 제공하지 않는다.
프론트 연결 단계에서 원하는 상태를 PUT/DELETE로 전달하고 응답의 is_wished를 반영한다.
비로그인 시 카드의 빈 ID/false 처리도 프론트에서 결정하며 API의 401 계약은 유지한다.

- 기존 `wishlists(user_id,product_id)` 복합 PK·users/products FK·CASCADE를 ORM으로 매핑했다.
  최초 migration의 기존 테이블을 사용하며 DDL 추가가 없다.
- 추가는 상품의 공개 상태를 `FOR SHARE`로 확인하고 같은 트랜잭션에서 저장한다.
  추가 요청끼리는 병행 가능하며 상품 삭제·판매 상태 변경은 추가 트랜잭션 종료까지 기다린다.
- PostgreSQL `ON CONFLICT (user_id,product_id) DO NOTHING`으로 **해당 PK 중복만** 성공 처리한다.
  FK 등 다른 IntegrityError를 중복으로 삼키지 않는다.
- Repository는 SQL만 실행한다. commit/rollback은 WishlistService가 같은 세션에서 처리한다.
  실패하면 전체 서비스 트랜잭션을 rollback하며 해당 세션을 복구한다. GET은 commit하지 않는다.
- 동시 PUT/DELETE가 겹친 경우 최종 상태는 DB에서 처리된 실행 순서에 따른다.
  마지막 클릭 시각·네트워크 응답 순서를 보장하지 않는다. 요청이 끝난 뒤 별도 PUT/DELETE로
  원하는 상태를 다시 지정하면 그 상태로 수렴한다. 화면 연타 제어는 7단계다.

새로운 찜 전용 도메인 클래스를 중복으로 만들지 않고 기존 상품 도메인의 품절 계산과
ProductSummary 변환을 재사용한다.

## 검증 결과

공용 DB와 기존 개발 DB를 사용하지 않고 새 로컬 Docker DB에서 검증했다.
별도 검증 사본을 만들어 실제 backend/.env를 변경하지 않았다.

- 찜 테스트 **17개 + ORM 계약 1개 = 18 passed**, 8.36초.
- P1·P2·P3·P4 전체 **482 passed / 0 skipped**, 99.20초.
  이 숫자는 모든 로컬 DB 옵션을 켠 통합 결과이며 GitHub CI의 두 job/실행별 숫자가 아니다.
- 새 로컬 DB `alembic upgrade head` 성공. head `3f21520f9615` 유지.
- `alembic check`: **No new upgrade operations detected**. migration 수정 없음.
- 기존 TestClient 사용 중단 예고 경고 1개, 테스트 실패 없음.

테스트는 실제 main.app에 HTTP 요청을 보내며 P1 회원가입·로그인으로 발급한 토큰을 사용한다.
세션 의존성만 로컬 DB로 바꾸고 인증 의존성은 교체하지 않는다.
ASGI 자동 검증이며 브라우저에서 Swagger를 수동 조작한 결과와 구분한다.

| 시나리오 | 응답·DB 증거 |
|---|---|
| 회원 A 찜 추가·중복 추가 | 200, A의 해당 행 0→1→1, created_at 동일 |
| A 요청에 B ID를 전달 | A 행만 생성, B 행 0 유지 |
| B가 같은 상품 해제 | 200, A 행 1 유지 |
| hidden/없는 상품 추가 | 404, 기존 찜 보존 |
| 찜한 상품을 hidden으로 변경 | 목록/IDs/total에서 제외, 본인 DELETE 허용 |
| 품절 상품 찜 | 200, 목록 품절 표시 유지 |
| 동일 시각 찜·페이지 조회 | ID 내림차순, 정확한 total, 마지막 이후 빈 목록 |
| 인증 없음·오류·만료·다른 서명·로그아웃·삭제 회원 | 모든 찜 API 401, 찜 추가 없음 |
| 동시 추가 8건 | 모두 200, 해당 PK 행 1개 |
| 동시 해제 8건 | 모두 200, 해당 행 0개 |
| 추가·해제 혼합 동시 요청 | 모두 200, 중복 행 없음, 이후 명시한 최종 상태로 수렴 |
| 실제 FK 오류 | 23503을 성공 처리하지 않음, 이전 미커밋 수정까지 원복, 같은 세션 재사용 성공 |
| Repository 작업 후 호출자 rollback | 다른 세션에 미커밋 찜 비노출, rollback 후 행 0 |
| 추가 중 상품 hidden 변경 | pg_blocking_pids로 대기 확인, 추가 commit 후 상태 변경, 목록에서 제외 |
| ORM 계약 | 초기 SQL과 컬럼·PK·FK·CASCADE 등 일치 |

검증 로그는 Git 제외 `backend/.venv/p2-stage6-review/backend/`의 `stage6-pytest.log`,
`stage6-alembic-check.log`에 있다. 테스트 컨테이너는 완료 후 삭제했다.

### 추가 점검 · PR 보류 이력과 재개

PR #59 병합 main `d18501c`를 반영하고 로컬 설치 기록을 보존했다. 생성물은 이제 ignore되며
6단계 변경에 포함되지 않는다. 이후 사용자가 **점검만 하고 PR은 올리지 말라**고 지시했으므로
6단계 commit·push·PR 생성은 수행하지 않았다.

- 팀의 수정하지 않은 `scripts/check.py`를 별도 검증 사본에서 실행: `CHECK_EXIT=0`.
- 마이그레이션 DB: **396 passed / 86 skipped**, 18.38초.
  skip은 명시적 실행 옵션을 끈 P2·P3 DB 테스트 84개와 관리자 DB 테스트 2개다.
- 다음 일회용 Docker DB 검사: **312 passed / 0 skipped**, 44.46초.
  앞 단계에서 제외된 P2·P3 DB 테스트를 이 단계에서 실행했다.
  관리자 DB 테스트 2개는 앞선 모든 옵션 활성화 통합 검사 **482 passed**에 포함됐다.
- 이 숫자는 로컬 공식 스크립트 실행 결과다. GitHub Actions 실행 결과로 표시하지 않는다.
- 실제 로컬 `uvicorn main:app`도 실행해 회원가입 201·로그인 200 후 발급 토큰으로 HTTP 호출했다.
  A의 찜 행은 추가·중복 추가·해제에 따라 **0→1→1→0**, B의 찜 행은 **0 유지**.
  로그아웃 204 이후 같은 토큰의 찜 조회는 **401**이었다. 토큰·비밀번호는 증거에 기록하지 않았다.
- 실제 서버 HTTP 검증 후에도 `alembic check` 추가 변경 없음. 로컬 서버·테스트 DB를 종료했다.
- 로그: Git 제외 `backend/.venv/stage6-pr-check.log`,
  `backend/.venv/p2-stage6-review/backend/stage6-http-evidence.json`.

공용 DB·배포 서버는 이 추가 점검에서도 변경하지 않았다. 이후 사용자가 PR 생성을 다시 요청해
보류를 해제했다. 검사 이후 실행 코드·테스트 변경이 없는 것을 파일 해시로 대조했다.

## 팀원 로컬 재현

Docker Desktop을 켜고 backend에서 실행한다. 이 테스트에는 원본 이미지 ZIP이 필요하지 않다.

```powershell
$env:P1_RUN_LOCAL_DB_TESTS = '0'
$env:DATABASE_URL = 'postgresql+asyncpg://unused:unused@127.0.0.1/unused'
$env:JWT_SECRET = 'local-wishlist-test-secret-with-at-least-32-characters'
$env:P2_RUN_POSTGRES_TESTS = '1'
uv run pytest tests/products/test_wishlist.py tests/products/test_model_schema.py -q
```

설정된 더미 URL에는 접속하지 않는다. 전용 fixture가 새 Docker DB를 만들고 실제 API 세션에 주입한다.
push 전 팀 기준 검사는 `uv run python scripts/check.py`이며 CI의 두 실행별 결과는 별도로 기록한다.

## 변경 파일·남은 작업

- `products/infrastructure/models.py`: WishlistModel.
- `products/infrastructure/wishlist.py`: 본인 목록/ID·멱등 저장/해제·상품 공개 상태 잠금.
- `products/application/wishlist_service.py`: 조회·상태 지정·commit/rollback.
- `products/presentation/wishlist_router.py`: P1 인증·요청/응답·개인 캐시 정책.
- `tests/products/test_wishlist.py`, `test_model_schema.py`: 실제 DB·인증·동시성·스키마 검증.
- 공통 `backend/src/main.py`: wishlist 라우터 import/등록 2줄. PR에서 P1 리뷰 대상이다.
- P1 인증 코드·공통 세션·core·compose·Alembic·P3/P4 코드는 수정하지 않았다.
- 프론트 코드·공용 DB·배포 서버는 변경하지 않았다. 서버에는 아직 5단계만 배포돼 있다.
- 사용자 요청으로 팀 main 대상 PR을 진행한다. GitHub CI·P1 공통 파일 리뷰·병합·서버 배포는 별도 확인한다.
- **6단계 구현·로컬 검증에서 정지. 7단계 화면 연결은 진행하지 않았다.**
