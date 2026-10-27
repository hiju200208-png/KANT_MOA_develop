# P1 #49 · P4 #50 연결 계약 대조

확인일: 2026-10-26 KST. 로컬 브랜치를 병합하거나 팀원 코드를 수정하지 않고 검토했다.

## 검토한 버전

- [P1 Draft PR #49](https://github.com/hiju200208-png/KANT_MOA_develop/pull/49): `heeju`, `6644edda4b1593a05b99ba697b9a23e6a8b620d5`.
- [P4 Draft PR #50](https://github.com/hiju200208-png/KANT_MOA_develop/pull/50): `feature/chungman`, `8b722cf8f38b133bb5c76559446a83ea498919fc`.
- 두 PR 모두 팀 저장소 main 대상이며 아직 미병합이다. 검토 당시 main은 `20edbcf`였다.

## P1: 인증 계약 일치

- `auth.presentation.dependencies`에 CurrentUser/get_current_user/require_admin이 실제 존재한다.
- CurrentUser는 id(UUID), email, nickname, role(str)을 반환하고 비밀번호 해시는 제외한다.
- Bearer 토큰 검증 → blacklist 확인 → DB 사용자 조회 → DB role 기반 권한 확인 순서다.
- 미인증 ApiError 401/NOT_AUTHENTICATED, 일반 회원 관리자 접근은 403/UNKNOWN이다.
  공통 handler가 401의 WWW-Authenticate: Bearer를 처리한다.
- 회원 Repository는 공통 database.Base/AsyncSession을 사용하고 commit하지 않는다.
- AuthService는 가입·로그아웃의 commit/rollback을 소유한다.
- 프론트 저장·복원과 Google 로그인은 이번 PR에서 완료되지 않았다.

## P1: 수정·보완 요청 사항

### 최초 revision과 현재 ORM의 불일치

`cd2b7db3c89b`의 users 정의는 현재 UserModel 및 초기 SQL과 다음이 다르다.

| 컬럼 | migration | 현재 ORM·초기 SQL |
|---|---|---|
| id | UUID, server_default 없음 | UUID, gen_random_uuid() |
| role | VARCHAR(5) | TEXT |

처음에는 DB 없이 revision upgrade의 create_table 인자를 비교했고, Docker 기동 후 새 전용 로컬 DB의
auth_migration_review 스키마에 실제 revision을 적용해 위 차이를 재확인했다.
현재 회원 Repository는 UUID를 직접 생성하므로 해당 API가 즉시 실패한다는 뜻은 아니다.
다만 migration으로 만든 DB와 공용 기준·ORM이 달라지고, ID를 생략하는 INSERT는 실패할 수 있다.
P1 로컬에 이미 적용된 revision이므로 파일만 조용히 수정하지 말고 적용 이력과 후속 보정 방식을 P1이 정해야 한다.
공용 DB에는 이 초기 생성 migration을 실행하거나 비교 없이 stamp하지 않는다.

### Alembic 모델 수집 범위

migrations/env.py는 auth 모델만 import한다. 새 프로세스에서 metadata를 확인하면 users/token_blacklist 두 테이블뿐이며,
초기 SQL의 나머지 16개 테이블이 없다. 공용 DB 대상으로 autogenerate하면 누락 테이블을 삭제 대상으로 제안할 수 있다.
전체 모델 수집 또는 명시적 관리 대상 필터를 정하고 생성안을 검토하기 전 공용 autogenerate를 하지 않는다.
Docker 기동 후 전용 로컬 DB에서 Alembic compare_metadata로 비교하자 실제로 16개 테이블의 remove_table 제안이 나왔다.
제안된 삭제 작업은 실행하지 않았고, 공용 DB에서는 비교·migration을 실행하지 않았다.

### 테스트 DB 격리

test_admin_permission/test_auth_service/test_auth_logout 등은 앱의 DATABASE_URL과 session_factory를 직접 사용한다.
일부는 회원·관리자를 실제 commit하고 cleanup에서 삭제한다. 전용 로컬 테스트 DB를 강제하는 fixture/명시적 실행 조건이 필요하다.
일반 앱 .env가 공용 DB로 바뀌었을 때 pytest가 그 DB를 사용하지 않도록 보완을 요청한다.
초기에는 DB 없는 테스트만 선택했다. Docker 기동 후 전체 검증에서는 새 전용 로컬 DB 주소를 강제로 주입했다.

## P4: 코드 확인 및 합의와 일치하는 부분

- 관리자 라우터 전체에 require_admin 의존성이 있다. P1이 없는 브랜치에서는 401로 닫힌다.
- 조회는 숨김 포함, 검색 값 바인딩·LIKE escape, 목록/total 같은 필터, ID tie-breaker가 있다.
- 옵션 없는 on_sale은 합계 0으로 품절, 수동 sold_out 유지, hidden은 별도로 취급한다.
- 상태 변경 서비스가 허용 상태를 검증하고, writer는 status만 UPDATE한다. stock을 수정하지 않는다.
  조회·변경·트랜잭션 adapter는 같은 session을 사용하며 서비스가 commit/rollback한다.
- P4가 같은 상품 테이블 ORM을 중복 정의한 것은 아니다. 현재 조회는 raw SQL이다.
  P2 ORM 재사용 전환은 PR에 명시된 미완료 항목이다.

## P4: 아직 연결 완료가 아닌 부분

- get_admin_stock_service는 여전히 ApiError(503)를 발생시킨다. 운영 P2 재고 adapter는 이번 head에 없다.
- P2 InsufficientStock/InvalidStock → P4 예외 변환 및 실제 same-session 저장은 후속 구현·검증 대상이다.
- main.py 관리자 라우터 등록, 실제 로그인 토큰 전달도 미완료다.
- 프론트 getAdminAccessToken은 잠정 localStorage 키를 읽는다. P1과 확정한 토큰 저장 계약이 아니다.
- 이미지 경로 변환은 잠정이며 P2 이미지 이관 때 맞춰야 한다.

## 독립 검증 결과와 한계

- 팀 main에 두 PR의 backend 변경분과 현재 로컬 P2 재고 보완을 조합한 별도 스냅샷에서 확인했다.
  현재 작업 트리를 병합하지 않았고 PR 파일도 수정하지 않았다.
- DB 없는 선택 테스트: **150 passed, 2 skipped**, 1.42초.
  P4 admin 테스트, P1 사용자 도메인/JWT 테스트, 공통 테스트, P2 재고 도메인 테스트다.
- 2 skipped는 명시적으로 비활성화한 P4 로컬 DB 통합 테스트다.
  P1 DB 인증/Repository 테스트와 P2 DB 테스트는 이번 선택 실행에 포함하지 않았다.
- 기존 TestClient httpx 사용 중단 예정 경고 1개가 있다.
- 후속 검증: 사용자가 Docker를 기동한 뒤 동일 스냅샷에서 **전체 171 passed**, 5.43초, skip 없음.
  P1 DB 회원/인증/로그아웃/권한·Repository, P4 로컬 DB 조회/상태 변경/공지, P2 DB 재고 테스트를 포함한다.
  실제 P4 재고 adapter는 여전히 미구현이며 P2의 테스트용 adapter 검증과 구분한다.
- DB는 기존 초기 SQL로 준비했다. 전체 테스트 통과를 P1 migration과 기존 공용 스키마의 일치 증명으로 보지 않는다.
- 별도 migration 검증: 새로운 전용 로컬 DB의 격리 스키마에 P1 revision을 적용해
  role=VARCHAR(5)/id 기본값 없음이 실제로 생성되는 것을 확인했다.
  인증 metadata와 초기 18개 테이블을 compare_metadata로 비교하면 나머지 16개의 삭제안이 생성됨도 확인했다.
  삭제안 실행·공용 DB 접속·공용 migration은 하지 않았다. 전용 테스트 컨테이너는 종료 후 제거했다.

## 다음 확인

1. P1: migration/ORM 불일치 정리, 모델 수집·테스트 DB 격리·공용 최초 이력 기준 결정.
2. P4: P2 ORM 재사용·재고 adapter·관리자 라우터 등록을 구현하고 실제 토큰·전용 로컬 DB에서 검증.
3. P2: 두 PR 반영 후 공용 DB와 무관한 로컬 조합 테스트 재실행. 이번 리뷰는 병합 승인이나 배포 완료를 의미하지 않는다.

## P1 후속 답변 (사용자 전달, 수정 커밋 확인 대기)

- P1은 171개 통과를 P1·P4·P2를 조합한 검증 결과로 구분해 기록하겠다고 답했다.
- 현재 ORM과 최초 revision의 차이를 인정했고, 이미 적용된 로컬 이력은 보존하면서
  role 자료형·UUID 기본값을 후속 revision으로 보정해 최종 head를 기준 스키마에 맞추는 방향을 제안했다.
- env.py는 전체 모델 수집 또는 명시적인 관리 대상 필터로 누락 모델의 테이블 삭제안이 생성되지 않도록 수정·검증할 예정이다.
- 로컬 정리 후 PR #49에 추가 push하고 커밋을 공유할 예정이다. **아직 수정 코드·새 revision ID·테스트 결과를 확인한 것은 아니다.**
- 공용 DB 재생성 없이 스키마 대조 → 최초 이력 처리 합의 → 필요한 변경 적용 순서로 진행하는 데 동의했다.
  공용 DB에 기록할 revision과 적용할 변경은 실제 스키마·이력 대조 후 결정한다. 최종 head를 곧바로 stamp하는 합의는 아니다.

## P4 후속 답변 (사용자 전달, push 후 코드 확인 대기)

- P4는 로컬에 `admin/infrastructure/variant_stock.py`의 P2VariantStockAdapter를 작성했다고 보고했다.
  요청마다 같은 session·Repository 인스턴스로 잠금 조회→순수 도메인 증감→save_variant/flush하며,
  AdminStockService가 commit/rollback한다. 요청마다 다시 잠금 조회하고 savepoint 경계를 넘기지 않는다는 설명이다.
- 누락·다른 상품 옵션은 404/rollback, P2 InsufficientStock→409, InvalidStock→422 변환을 구현했다고 보고했다.
- 383acb9의 nested transaction 검사까지 적용한 로컬 DB에서 +5 반영, 음수 재고 거부 409 후 재고 유지,
  다른 상품 옵션 404가 통과했다는 **P4 보고**다. P2가 해당 adapter 코드를 독립 검증한 결과는 아직 아니다.
- 상태 변경 writer 위치는 유지하고 P2 ORM 재사용 정리도 진행할 예정이다.
- 선택 #39의 대표 이미지 교체 API PUT /admin/products/{id}/thumbnail을 함께 PR #50에 push할 예정이다.
  products.thumbnail_path만 변경, 서비스 트랜잭션, 실패 시 저장 파일 삭제 방식이라고 설명했다.
- 이미지 교체 추가 확인 기준: require_admin 보호, 실제 파일 형식·크기 검증, 서버 생성 파일명·uploads 상대 경로,
  재고 등 다른 상품 필드 미변경, rollback 시 이번 요청이 새로 저장한 파일만 정리.
  기존 static/공유 이미지나 다른 요청의 파일을 삭제하지 않고, commit 성공 후 응답 실패를 이유로
  이미 DB가 참조하는 새 파일을 삭제하지 않아야 한다. 실제 코드를 보고 이 범위를 검토한다.
- adapter·예외 변환·대표 이미지 교체는 아직 push 전이라는 보고이므로 #50의 미완료 항목을 완료로 단정하지 않는다.

## P4 추가 push 재검증 (2026-10-26, d10bc59)

이 절은 위의 P4 push 대기 기록을 갱신한다. PR #50은 아직 Draft이며, 병합·배포 완료를 뜻하지 않는다.

- 확인 커밋: `d71345a`(재고 adapter·대표 이미지), `d10bc59`(P2 ORM 재사용).
- 별도 검증 복사본: 팀 main `96f2089` + P1 `6644edd` + P4 `d10bc59`의 backend 변경분.
  P2 `383acb9`의 Repository/savepoint 보완은 main에 포함된 상태다. 현재 작업 트리는 병합하지 않았다.
- P2VariantStockAdapter가 요청별 같은 ProductRepository/AsyncSession으로 잠금 조회 → 도메인 증감 → save_variant/flush한다.
  서비스가 commit/rollback하며 누락·다른 상품 옵션 404, 재고 부족 409, 잘못된 조정 422로 변환한다.
- 관리자 상품 조회·상태 변경·대표 이미지 writer가 P2 ORM을 재사용한다.
  상태 writer는 status, 이미지 writer는 thumbnail_path만 갱신한다.
- 대표 이미지: 관리자 권한, JPG/PNG/WebP MIME·매직 바이트·5MiB 제한, UUID 파일명,
  /uploads/products 저장, DB 실패 시 이번 파일만 정리, 기존 파일 보존 흐름을 확인했다.

### 실행 결과와 수정 요청

- PR 원본 테스트 조합: **197 passed, 2 errors**, skip 없음.
  두 오류는 같은 5MiB 초과 사례의 setup/teardown이다. 자동 생성된 긴 테스트 이름이
  PYTEST_CURRENT_TEST 환경변수에 들어가 Windows의 32767자 제한을 초과한다.
  위치: `backend/tests/admin/test_admin_image.py`의 test_rejected_images parametrize.
  P4 수정 요청: `ids=["unsupported-format", "signature-mismatch", "html", "empty", "over-5mb"]` 등 짧은 이름 지정.
- 검증용 복사본에서 위 테스트 이름만 보정한 뒤 **198 passed**, skip 없음, 5.97초.
  원본 작업 파일·P4 브랜치를 수정하지 않았다. 기존 TestClient 사용 중단 예정 경고 1개는 남는다.
- 추가 실제 DB/HTTP 시나리오도 통과했다. P1 실제 로그인 토큰과 require_admin을 사용했다.
  비로그인 401 / USER 403 / ADMIN 200, +5 재고 반영, 과다 차감 409 후 재고 유지,
  조정 0의 422, 다른 상품 옵션 404, 로그아웃 후 동일 토큰 401을 확인했다.
- 이미지 업로드·공개 조회, 실제 SQL 실패 후 DB rollback 및 이번 파일 삭제,
  기존 이미지 보존, commit 뒤 응답 500 발생 시 DB가 참조하는 새 파일 보존을 확인했다.
  이미지 변경 시 가격·판매 상태·재고도 유지됐다.
- 모든 DB 검증은 새로 생성한 로컬 Docker DB에서 수행하고 해당 테스트 컨테이너를 제거했다.
  공용 DB 접속·초기화·초기 SQL 재실행·migration/stamp는 하지 않았다.

### 남은 통합 범위

- 위 실제 토큰 시나리오는 검증용 FastAPI 앱에 실제 auth/admin router를 함께 등록했다.
  현재 main.py에는 admin router 등록이 아직 없어 배포 앱에서 관리자 API가 열린다는 검증은 아니다.
- PR 본문에 남은 P1 인증 main 반영 후 admin router 등록, 프론트 토큰 연결,
  이미지 이관 경로 확정은 별도 미완료 항목으로 유지한다. 프론트 화면 재검증은 이번 실행 범위에 포함하지 않았다.
- P1 migration 후속 수정 검증은 이 결과와 별개다. PR #49의 새 커밋을 확인한 뒤 검증한다.

## P1 migration 후속 수정 재검증 (2026-10-26, 153b031)

이 절은 위 P1 수정 대기 기록을 갱신한다. 공용 적용·배포 완료를 의미하지 않는다.

- PR #49 head `153b0314dedd83d3f2ee16330adbd994a812a503`을 별도 복사본으로 검증했다.
  최초 `cd2b7db3c89b`는 유지됐으며 계보는 `cd2b7db3c89b` → `b49bcc205bbc` → `3f21520f9615` 단일 head다.
- 중간 revision은 나머지 16개 업무 테이블과 기본 배송지 부분 UNIQUE 인덱스를 생성한다.
  마지막 revision은 users.role TEXT 및 users.id gen_random_uuid() 기본값을 정렬한다.
- env.py는 인증·상품 7개 모델을 수집하며, DB에만 있는 미등록 테이블의 자동 삭제안을 제외한다.
  자료형·서버 기본값 비교도 활성화됐다. 전체 18개 ORM 등록이나 모든 삭제 방지를 의미하지 않는다.
- 새 전용 Docker DB에서 초기 SQL을 먼저 실행하지 않고 `alembic upgrade head` 성공.
  업무 테이블 18개 + alembic_version 총 19개, role TEXT, UUID 기본값을 실제 조회했다.
- `alembic check`: `No new upgrade operations detected.`
- 사용자 한 건을 저장한 뒤 마지막 revision만 downgrade/re-upgrade해 동일 UUID·회원 데이터 보존을 확인했다.
- 같은 테스트 컨테이너의 별도 baseline DB에 초기 SQL을 적용해 비교했다.
  users 제외 17개 테이블의 컬럼·자료형·NULL·기본값·identity와 PK/UNIQUE/FK/CHECK 정의는 일치했다.
  모든 인덱스·공용 실DB 구조의 일치 검증을 뜻하지 않는다. users의 추가 CHECK·블랙리스트 인덱스 등
  기존 공용 기준과의 차이는 P1 문서대로 후속 대조 대상이다.
- P1 branch 전체 테스트: **79 passed, 0 skipped**, 4.26초, TestClient 경고 1개.
  P1_RUN_LOCAL_DB_TESTS=1, P2_RUN_POSTGRES_TESTS=1, ADMIN_DB_TEST=1로 실행해
  P1 보고의 76 passed/3 skipped에서 건너뛴 P2 DB 테스트 3개도 실행했다.
  P4 최신 Draft 전체를 조합한 198개 결과와 구분한다.
- 전용 테스트 컨테이너는 종료 후 제거했다. 공용 DB에는 접속하지 않았으며 migration/stamp도 하지 않았다.
- 판정: 이번 로컬 migration 수정에서 추가 차단 오류는 발견하지 못했다.
  다음 단계는 공용 전체 스키마 대조 및 기존 테이블을 재생성하지 않는 이력·차이 적용 절차 준비다.
  최초/중간 생성 revision을 기존 공용 DB에 그대로 실행하거나 최종 head로 바로 stamp하지 않는다.

## PR #49 최종 리뷰 (2026-10-26, 0b407e2)

- GitHub 확인: head `0b407e2beb9d51a38821ed1572e4dc2301fc6956`, 대상 팀 main `0e8cceb`,
  Draft 해제·병합 가능 상태. 최신 main이 head의 조상임을 로컬 Git에서도 확인했고 공백 검사도 통과했다.
- 이전 검증 `153b031` 이후 인증·migration·main.py·공통 테스트 설정의 추가 변경은 없었다.
  main에 병합된 P2·P4 변경분과 최종 검증 문서가 반영됐다.
- PR head 원본 backend를 별도 복사본으로 추출해 새 로컬 Docker DB에서 검증했다.
  `P1_RUN_LOCAL_DB_TESTS=1`, `P2_RUN_POSTGRES_TESTS=1`, `ADMIN_DB_TEST=1`을 사용해
  **198 passed, 0 skipped**, 5.87초. TestClient 경고 1개가 남는다.
  P1 보고의 181 passed/17 skipped에서 선택 DB 테스트까지 실행한 결과다.
- 빈 DB의 전체 migration 적용, 단일 head `3f21520f9615`, alembic check 추가 변경 없음 확인.
  마지막 revision downgrade/re-upgrade 후 회원 데이터 보존과 users 이외 17개 테이블의
  컬럼/기본값/identity/제약 초기 SQL 대조도 다시 통과했다.
- 검증용 앱에 실제 auth/admin router를 등록한 추가 시나리오에서 P1 로그인 토큰의
  401/403/200·로그아웃 후 동일 토큰 401, P4 재고·이미지 rollback과 파일 보존까지 통과했다.
  main.py에는 아직 auth router만 등록돼 있어 실제 배포 앱의 관리자 API 개방 검증과 구분한다.
- **최종 판정: 이번 리뷰에서 병합을 막는 추가 결함을 발견하지 못했다. 팀 main 병합 가능.**
  공용 DB 이력·필요 변경 적용, 서버 배포, 관리자 라우터 등록, 프론트 토큰 연결은 후속이다.
- 공용 DB 접속·변경, GitHub 리뷰 게시·병합·push는 하지 않았다. 전용 테스트 컨테이너는 제거했다.
