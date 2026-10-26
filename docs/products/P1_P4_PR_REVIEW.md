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
